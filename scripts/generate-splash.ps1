# Generates build/splash.bmp at 2x (800x600) — the frameless KruDee installer
# backdrop. Rendered at 2x so the DPI-aware installer can downscale it crisply
# (SS_REALSIZECONTROL) instead of Windows upscaling a 1x bitmap (which blurs).
# Theme fits the app: an RFID attendance kiosk — a tap-card with signal waves and
# a green "checked-in" badge. The logo is baked in; there is no AVI animation.
# Run with pwsh 7 (UTF-8) so the Thai strings render correctly.
Add-Type -AssemblyName System.Drawing

$SC = 2                 # supersample factor (design in 400x300, render at 800x600)
$width = 400 * $SC
$height = 300 * $SC
$root = Join-Path $PSScriptRoot '..'
$iconPath = Join-Path $root 'resources\icon.png'
$outDir = Join-Path $root 'build'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

# Education blue gradient (top -> bottom).
$topColor = [System.Drawing.Color]::FromArgb(37, 99, 235)    # blue-600 #2563eb
$botColor = [System.Drawing.Color]::FromArgb(30, 58, 138)    # blue-900 #1e3a8a

function S([double]$v) { return [float]($v * $SC) }

function New-RoundedRectanglePath {
    param([System.Drawing.RectangleF]$Rectangle, [float]$Radius)
    $d = $Radius * 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($Rectangle.X, $Rectangle.Y, $d, $d, 180, 90)
    $path.AddArc($Rectangle.Right - $d, $Rectangle.Y, $d, $d, 270, 90)
    $path.AddArc($Rectangle.Right - $d, $Rectangle.Bottom - $d, $d, $d, 0, 90)
    $path.AddArc($Rectangle.X, $Rectangle.Bottom - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-SplashImage {
    param([string]$OutputPath)

    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bitmap)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Background gradient.
    $bgRect = [System.Drawing.Rectangle]::new(0, 0, $width, $height)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($bgRect, $topColor, $botColor, 90)
    $g.FillRectangle($bgBrush, $bgRect)

    # Soft light blobs for depth.
    $blob1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(30, 147, 197, 253))
    $g.FillEllipse($blob1, (S -70), (S -110), (S 250), (S 250))
    $blob2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(26, 30, 64, 175))
    $g.FillEllipse($blob2, (S 300), (S 200), (S 240), (S 240))
    $blob1.Dispose(); $blob2.Dispose()

    # Faint dotted "roster" grid in the lower band (attendance rows motif).
    $dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(22, 219, 234, 254))
    for ($row = 0; $row -lt 3; $row++) {
        for ($col = 0; $col -lt 12; $col++) {
            $g.FillEllipse($dotBrush, (S (30 + $col * 30)), (S (250 + $row * 12)), (S 3), (S 3))
        }
    }
    $dotBrush.Dispose()

    # --- Hero: logo card with RFID signal waves + green checked-in badge. ---
    $cardX = 155; $cardY = 46; $cardW = 90; $cardH = 90; $cardR = 20
    $cardCenterX = $cardX + $cardW / 2

    # Signal waves emanating from the top-right (the "tap" gesture).
    $waveOX = $cardX + $cardW - 6
    $waveOY = $cardY + 10
    for ($i = 1; $i -le 3; $i++) {
        $r = 16 + $i * 13
        $alpha = [int](150 - $i * 34)
        $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb($alpha, 191, 219, 254), [float](S 2.5))
        $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $g.DrawArc($pen, (S ($waveOX - $r)), (S ($waveOY - $r)), (S ($r * 2)), (S ($r * 2)), -68, 60)
        $pen.Dispose()
    }

    # Card drop shadow + white rounded tile.
    $shadow = New-RoundedRectanglePath ([System.Drawing.RectangleF]::new((S ($cardX + 3)), (S ($cardY + 5)), (S $cardW), (S $cardH))) (S $cardR)
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 15, 23, 42))
    $g.FillPath($shadowBrush, $shadow)
    $card = New-RoundedRectanglePath ([System.Drawing.RectangleF]::new((S $cardX), (S $cardY), (S $cardW), (S $cardH))) (S $cardR)
    $cardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
    $g.FillPath($cardBrush, $card)
    # NOTE: the logo is NOT baked here — the installer plays an AVI (white bg,
    # animated logo) centered on this white card, so there is no double image.

    # NOTE: the green "checked-in" badge is NOT drawn here — it lives in the AVI
    # frames (which render on top of this card), otherwise the AVI control's white
    # square would overlap and clip a badge baked into the splash.

    # --- Text ---
    $centerFmt = New-Object System.Drawing.StringFormat
    $centerFmt.Alignment = [System.Drawing.StringAlignment]::Center
    $leftFmt = New-Object System.Drawing.StringFormat
    $leftFmt.Alignment = [System.Drawing.StringAlignment]::Near
    $rightFmt = New-Object System.Drawing.StringFormat
    $rightFmt.Alignment = [System.Drawing.StringAlignment]::Far

    $brandFont = New-Object System.Drawing.Font('Leelawadee UI', (S 22), [System.Drawing.FontStyle]::Bold)
    $subFont = New-Object System.Drawing.Font('Leelawadee UI', (S 10.5))
    $microFont = New-Object System.Drawing.Font('Leelawadee UI', (S 7.5), [System.Drawing.FontStyle]::Bold)
    $footFont = New-Object System.Drawing.Font('Segoe UI', (S 7))
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $sub = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(205, 219, 234, 254))
    $accent = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 134, 239, 172))  # green-300
    $foot = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(120, 191, 219, 254))

    # Clean, centered layout. The progress bar (drawn by the installer at y=240)
    # sits below the subtitle; a single caption goes under it, url at the foot.
    $g.DrawString('ครูดี', $brandFont, $white, [System.Drawing.RectangleF]::new(0, (S 148), $width, (S 40)), $centerFmt)
    $g.DrawString('ระบบบันทึกเวลาเข้า–ออกโรงเรียน', $subFont, $sub, [System.Drawing.RectangleF]::new(0, (S 184), $width, (S 24)), $centerFmt)
    $g.DrawString('กำลังติดตั้ง • เช็คชื่อด้วยบัตร RFID', $microFont, $accent, [System.Drawing.RectangleF]::new(0, (S 253), $width, (S 14)), $centerFmt)
    $g.DrawString('krudee.workitdee.com', $footFont, $foot, [System.Drawing.RectangleF]::new(0, (S 276), $width, (S 16)), $centerFmt)

    # Save full 800x600 as 24bpp (no alpha). The DPI-aware installer downscales
    # this crisply to the physical control size via SS_REALSIZECONTROL.
    $final = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $fg = [System.Drawing.Graphics]::FromImage($final)
    $fg.DrawImage($bitmap, 0, 0, $width, $height)
    $fg.Dispose()
    $final.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $final.Dispose()

    $bgBrush.Dispose(); $shadow.Dispose(); $shadowBrush.Dispose(); $card.Dispose(); $cardBrush.Dispose()
    $badgeRing.Dispose(); $badge.Dispose(); $checkPen.Dispose()
    $brandFont.Dispose(); $subFont.Dispose(); $microFont.Dispose(); $footFont.Dispose()
    $white.Dispose(); $sub.Dispose(); $accent.Dispose(); $foot.Dispose()
    $centerFmt.Dispose(); $leftFmt.Dispose(); $rightFmt.Dispose(); $g.Dispose(); $bitmap.Dispose()
}

$outputPath = Join-Path $outDir 'splash.bmp'
New-SplashImage -OutputPath $outputPath
Write-Host "Created $outputPath (${width}x${height}, 24bpp)"
