# Rebuilds resources/icon.ico from resources/icon.png (512x512) with correct
# per-size directory entries (16..256). The previous icon.ico declared every
# entry as 256x256, so Windows upscaled a wrong image for small shortcut sizes
# and the result looked blurry. Each entry here is a 32bpp BGRA DIB + AND mask.
Add-Type -AssemblyName System.Drawing

$root = Join-Path $PSScriptRoot '..'
$srcPath = Join-Path $root 'resources\icon.png'
$outPath = Join-Path $root 'resources\icon.ico'
$sizes = @(16, 24, 32, 48, 64, 128, 256)

$src = [System.Drawing.Image]::FromFile($srcPath)

# NSIS's icon reader rejects large uncompressed BMP entries, so sizes >= this
# threshold are stored PNG-compressed (Vista ICO format); smaller sizes stay BMP.
$pngThreshold = 0

function Get-IconImage([System.Drawing.Image]$Image, [int]$Size) {
    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($Image, 0, 0, $Size, $Size)
    $g.Dispose()
    return $bmp
}

function Get-IconPng([System.Drawing.Image]$Image, [int]$Size) {
    $bmp = Get-IconImage $Image $Size
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()
    $ms.Dispose(); $bmp.Dispose()
    return ,[byte[]]$bytes
}

function Get-IconDib([System.Drawing.Image]$Image, [int]$Size) {
    $bmp = Get-IconImage $Image $Size
    $ms = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter($ms)
    # BITMAPINFOHEADER (height doubled: XOR bitmap + AND mask)
    $bw.Write([uint32]40); $bw.Write([int32]$Size); $bw.Write([int32]($Size * 2))
    $bw.Write([uint16]1); $bw.Write([uint16]32); $bw.Write([uint32]0)
    $bw.Write([uint32]0); 1..4 | ForEach-Object { $bw.Write([uint32]0) }
    # XOR: 32bpp BGRA, bottom-up
    for ($y = $Size - 1; $y -ge 0; $y--) {
        for ($x = 0; $x -lt $Size; $x++) {
            $c = $bmp.GetPixel($x, $y)
            $bw.Write([byte]$c.B); $bw.Write([byte]$c.G); $bw.Write([byte]$c.R); $bw.Write([byte]$c.A)
        }
    }
    # AND mask: 1bpp, rows padded to 32-bit, bottom-up. 0 = opaque (alpha carries transparency).
    $maskRowBytes = [Math]::Floor(($Size + 31) / 32) * 4
    for ($y = 0; $y -lt $Size; $y++) {
        for ($b = 0; $b -lt $maskRowBytes; $b++) { $bw.Write([byte]0) }
    }
    $bw.Flush()
    $bytes = $ms.ToArray()
    $bw.Dispose(); $ms.Dispose(); $bmp.Dispose()
    return ,[byte[]]$bytes
}

$data = @{}
foreach ($s in $sizes) {
    if ($s -ge $pngThreshold) { $data[$s] = Get-IconPng $src $s }
    else { $data[$s] = Get-IconDib $src $s }
}
$src.Dispose()

$fs = [System.IO.File]::Create($outPath)
$w = New-Object System.IO.BinaryWriter($fs)
# ICONDIR
$w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]$sizes.Count)
$offset = 6 + (16 * $sizes.Count)
foreach ($s in $sizes) {
    $bytes = $data[$s]
    $wb = if ($s -ge 256) { 0 } else { $s }
    $w.Write([byte]$wb); $w.Write([byte]$wb)   # width, height (0 = 256)
    $w.Write([byte]0); $w.Write([byte]0)        # colors, reserved
    $w.Write([uint16]1); $w.Write([uint16]32)   # planes, bpp
    $w.Write([uint32]$bytes.Length); $w.Write([uint32]$offset)
    $offset += $bytes.Length
}
foreach ($s in $sizes) { $w.Write([byte[]]$data[$s], 0, ([byte[]]$data[$s]).Length) }
$w.Dispose(); $fs.Dispose()
Write-Host "Created $outPath ($($sizes -join ', '))"
