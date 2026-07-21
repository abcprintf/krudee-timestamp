# Generates build/installer-logo.avi — an uncompressed DIB AVI played by the
# native SysAnimate32 control over the white logo card while NSIS extracts.
# White background (matches the card), so it needs no gradient matching, and the
# DPI-aware installer renders it 1:1 (crisp). The KruDee logo sits centered with
# a pulsing blue ring + an orbiting accent dot.
Add-Type -AssemblyName System.Drawing

$size = 88
$fps = 30
$frameCount = 60
$root = Join-Path $PSScriptRoot '..'
$iconPath = Join-Path $root 'resources\icon.png'
$outDir = Join-Path $root 'build'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
$outputPath = Join-Path $outDir 'installer-logo.avi'

function Write-FourCC([System.IO.BinaryWriter]$Writer, [string]$Value) { $Writer.Write([Text.Encoding]::ASCII.GetBytes($Value)) }
function Start-Chunk([System.IO.BinaryWriter]$Writer, [string]$Id) { Write-FourCC $Writer $Id; $p = $Writer.BaseStream.Position; $Writer.Write([uint32]0); return $p }
function End-Chunk([System.IO.BinaryWriter]$Writer, [long]$SizePosition) {
    $end = $Writer.BaseStream.Position; $size = $end - $SizePosition - 4
    $Writer.BaseStream.Position = $SizePosition; $Writer.Write([uint32]$size); $Writer.BaseStream.Position = $end
    if (($size % 2) -ne 0) { $Writer.Write([byte]0) }
}

function New-AnimationFrame([int]$Index, [System.Drawing.Image]$Icon) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bitmap)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # White background (matches the splash card interior).
    $g.Clear([System.Drawing.Color]::White)

    $cx = $size / 2; $cy = $size / 2
    $phase = (2 * [Math]::PI * $Index) / $frameCount
    $pulse = (1 + [Math]::Sin($phase)) / 2

    # Pulsing blue ring behind the logo.
    $ringR = 34 + (3 * $pulse)
    $ringPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb([int](60 + 40 * $pulse), 37, 99, 235), 2.0)
    $g.DrawEllipse($ringPen, $cx - $ringR, $cy - $ringR, $ringR * 2, $ringR * 2)
    $ringPen.Dispose()

    # Logo centered.
    $g.DrawImage($Icon, [int]($cx - 26), [int]($cy - 26), 52, 52)

    # Orbiting accent dot (green — the "checked-in" colour), travels around the ring.
    $angle = $phase * 2
    $dotX = $cx + ($ringR * [Math]::Cos($angle))
    $dotY = $cy + ($ringR * [Math]::Sin($angle))
    $dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 34, 197, 94))
    $g.FillEllipse($dotBrush, $dotX - 3, $dotY - 3, 6, 6)
    $dotBrush.Dispose()

    # Static green "checked-in" badge at the bottom-right (lives here, on top of
    # the card, so it is never clipped by the animation control's square).
    $bx = $size - 15; $by = $size - 15; $br = 13
    $ringBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillEllipse($ringBrush, $bx - $br - 2, $by - $br - 2, ($br + 2) * 2, ($br + 2) * 2)
    $badgeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 34, 197, 94))
    $g.FillEllipse($badgeBrush, $bx - $br, $by - $br, $br * 2, $br * 2)
    $checkPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 2.4)
    $checkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $checkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $checkPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawLines($checkPen, [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new($bx - 5, $by),
        [System.Drawing.PointF]::new($bx - 1.5, $by + 4),
        [System.Drawing.PointF]::new($bx + 5, $by - 4.5)
    ))
    $ringBrush.Dispose(); $badgeBrush.Dispose(); $checkPen.Dispose(); $g.Dispose()
    return $bitmap
}

function Get-DibBytes([System.Drawing.Bitmap]$Bitmap) {
    $rowSize = (($size * 3 + 3) -band -4)
    $bytes = New-Object byte[] ($rowSize * $size)
    for ($y = 0; $y -lt $size; $y++) {
        $sy = $size - 1 - $y
        for ($x = 0; $x -lt $size; $x++) {
            $c = $Bitmap.GetPixel($x, $sy); $o = ($y * $rowSize) + ($x * 3)
            $bytes[$o] = $c.B; $bytes[$o + 1] = $c.G; $bytes[$o + 2] = $c.R
        }
    }
    return ,[byte[]]$bytes
}

$icon = [System.Drawing.Image]::FromFile($iconPath)
$frames = New-Object System.Collections.Generic.List[byte[]]
for ($i = 0; $i -lt $frameCount; $i++) { $f = New-AnimationFrame $i $icon; $frames.Add((Get-DibBytes $f)); $f.Dispose() }
$icon.Dispose()

$stream = [System.IO.File]::Create($outputPath)
$writer = New-Object System.IO.BinaryWriter($stream)
$riff = Start-Chunk $writer 'RIFF'; Write-FourCC $writer 'AVI '
$hdrl = Start-Chunk $writer 'LIST'; Write-FourCC $writer 'hdrl'
$avih = Start-Chunk $writer 'avih'
$writer.Write([uint32](1000000 / $fps)); $writer.Write([uint32]($frames[0].Length * $fps)); $writer.Write([uint32]0); $writer.Write([uint32]0x10)
$writer.Write([uint32]$frameCount); $writer.Write([uint32]0); $writer.Write([uint32]1); $writer.Write([uint32]$frames[0].Length)
$writer.Write([uint32]$size); $writer.Write([uint32]$size); 1..4 | ForEach-Object { $writer.Write([uint32]0) }
End-Chunk $writer $avih
$strl = Start-Chunk $writer 'LIST'; Write-FourCC $writer 'strl'
$strh = Start-Chunk $writer 'strh'
Write-FourCC $writer 'vids'; Write-FourCC $writer 'DIB '; $writer.Write([uint32]0); $writer.Write([uint16]0); $writer.Write([uint16]0)
$writer.Write([uint32]0); $writer.Write([uint32]1); $writer.Write([uint32]$fps); $writer.Write([uint32]0); $writer.Write([uint32]$frameCount)
$writer.Write([uint32]$frames[0].Length); $writer.Write([int32]-1); $writer.Write([uint32]0)
$writer.Write([int16]0); $writer.Write([int16]0); $writer.Write([int16]$size); $writer.Write([int16]$size)
End-Chunk $writer $strh
$strf = Start-Chunk $writer 'strf'
$writer.Write([uint32]40); $writer.Write([int32]$size); $writer.Write([int32]$size); $writer.Write([uint16]1); $writer.Write([uint16]24)
$writer.Write([uint32]0); $writer.Write([uint32]$frames[0].Length); 1..4 | ForEach-Object { $writer.Write([uint32]0) }
End-Chunk $writer $strf; End-Chunk $writer $strl; End-Chunk $writer $hdrl
$movi = Start-Chunk $writer 'LIST'; Write-FourCC $writer 'movi'
$offsets = New-Object System.Collections.Generic.List[uint32]
$offset = 4
foreach ($data in $frames) {
    $offsets.Add([uint32]$offset); Write-FourCC $writer '00db'; $writer.Write([uint32]$data.Length); $writer.Write([byte[]]$data, 0, ([byte[]]$data).Length)
    if (($data.Length % 2) -ne 0) { $writer.Write([byte]0) }; $offset += 8 + $data.Length + ($data.Length % 2)
}
End-Chunk $writer $movi
$idx1 = Start-Chunk $writer 'idx1'
for ($i = 0; $i -lt $frameCount; $i++) { Write-FourCC $writer '00db'; $writer.Write([uint32]0x10); $writer.Write($offsets[$i]); $writer.Write([uint32]$frames[$i].Length) }
End-Chunk $writer $idx1; End-Chunk $writer $riff
$writer.Dispose(); $stream.Dispose()
Write-Host "Created $outputPath ($size x $size, $frameCount frames at $fps fps)"
