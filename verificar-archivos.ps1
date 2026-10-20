# Compara los archivos del backend con MANIFIESTO-SHA256.txt (ejecutar dentro de la carpeta backend).
# Muestra los archivos que faltan (borrados o en cuarentena) y los que cambiaron.
$faltan = 0; $distintos = 0
Get-Content .\MANIFIESTO-SHA256.txt | ForEach-Object {
  $hash, $ruta = $_ -split '  ', 2
  $ruta = $ruta -replace '/', '\'
  if (-not (Test-Path $ruta)) { Write-Host "FALTA      $ruta" -ForegroundColor Red; $faltan++ }
  elseif ((Get-FileHash $ruta -Algorithm SHA256).Hash -ne $hash) { Write-Host "MODIFICADO $ruta" -ForegroundColor Yellow; $distintos++ }
}
Write-Host "`nFaltan: $faltan  ·  Modificados: $distintos" -ForegroundColor Cyan
