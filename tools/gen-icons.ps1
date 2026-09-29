Add-Type -AssemblyName System.Drawing

$outDir = 'D:\work\w\assets\marker'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-Pin {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Fill,
    [Parameter(Mandatory = $true)][string]$Ring,
    [string]$Glyph = '',
    [string]$GlyphColor = '#FFFFFF',
    [int]$Size = 96,
    [double]$S = 1.0
  )
  $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $cx = $Size / 2.0
  $cy = $Size / 2.0
  [double]$outer = $Size * 0.46 * $S
  [double]$inner = $Size * 0.345 * $S
  [double]$ringW = $Size * 0.055

  $shadow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(55, 0, 0, 0))
  $g.FillEllipse($shadow, [single]($cx - $outer), [single]($cy - $outer + $Size * 0.045), [single]($outer * 2), [single]($outer * 2))

  $ringBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($Ring))
  $g.FillEllipse($ringBrush, [single]($cx - $outer), [single]($cy - $outer), [single]($outer * 2), [single]($outer * 2))

  $whitePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(235, 255, 255, 255)), ([single]$ringW)
  [double]$r2 = $outer - $ringW * 0.75
  $g.DrawEllipse($whitePen, [single]($cx - $r2), [single]($cy - $r2), [single]($r2 * 2), [single]($r2 * 2))

  $fillBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($Fill))
  $g.FillEllipse($fillBrush, [single]($cx - $inner), [single]($cy - $inner), [single]($inner * 2), [single]($inner * 2))

  if ($Glyph -ne '') {
    $font = New-Object System.Drawing.Font('Microsoft YaHei', ([single]($inner * 1.15)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel))
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF(0, 0, ([single]$Size), ([single]$Size))
    $gb = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($GlyphColor))
    $g.DrawString($Glyph, $font, $gb, $rect, $sf)
  }

  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

$defs = @(
  @{ n = 'pin-all.png';         f = '#8C1F28'; r = '#B8860B'; gl = '';   s = 0.95 },
  @{ n = 'pin-all-on.png';      f = '#8C1F28'; r = '#FFD24D'; gl = '';   s = 1.18 },
  @{ n = 'pin-red.png';         f = '#C0392B'; r = '#B8860B'; gl = '星'; s = 0.92 },
  @{ n = 'pin-red-on.png';      f = '#C0392B'; r = '#FFD24D'; gl = '星'; s = 1.16 },
  @{ n = 'pin-official.png';    f = '#1F5C8B'; r = '#B8860B'; gl = '廉'; s = 0.92 },
  @{ n = 'pin-official-on.png'; f = '#1F5C8B'; r = '#FFD24D'; gl = '廉'; s = 1.16 },
  @{ n = 'pin-family.png';      f = '#B8860B'; r = '#8C1F28'; gl = '家'; s = 0.92 },
  @{ n = 'pin-family-on.png';   f = '#B8860B'; r = '#FFD24D'; gl = '家'; s = 1.16 },
  @{ n = 'pin-edu.png';         f = '#2E7D5B'; r = '#B8860B'; gl = '警'; s = 0.92 },
  @{ n = 'pin-edu-on.png';      f = '#2E7D5B'; r = '#FFD24D'; gl = '警'; s = 1.16 },
  @{ n = 'pin-industry.png';    f = '#6A4C93'; r = '#B8860B'; gl = '清'; s = 0.92 },
  @{ n = 'pin-industry-on.png'; f = '#6A4C93'; r = '#FFD24D'; gl = '清'; s = 1.16 },
  @{ n = 'pin-home.png';        f = '#FF6B35'; r = '#8C1F28'; gl = '乡'; s = 1.10 },
  @{ n = 'pin-me.png';          f = '#2F80ED'; r = '#FFFFFF'; gl = '';   s = 0.70 }
)

foreach ($d in $defs) {
  New-Pin -Path (Join-Path $outDir $d.n) -Fill $d.f -Ring $d.r -Glyph $d.gl -S $d.s
}

Get-ChildItem $outDir | Select-Object Name, Length | Format-Table -AutoSize
