$ErrorActionPreference='Stop'
$nativeRoot=(Resolve-Path (Join-Path $PSScriptRoot '../src/native')).Path
$compiler='C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$framework='C:/Windows/Microsoft.NET/Framework64/v4.0.30319'
$refs='C:/Program Files (x86)/Reference Assemblies/Microsoft/Framework/.NETFramework/v4.8'
$sdk='C:/Program Files (x86)/Windows Kits/10/References/10.0.20348.0'
& $compiler /nologo /target:winexe /platform:x64 "/out:$nativeRoot\GlassHelper.exe" "$nativeRoot\GlassHelper.cs"
if($LASTEXITCODE -ne 0){throw 'GlassHelper build failed'}
$referenceArgs=@(
 "$framework/System.Runtime.WindowsRuntime.dll",
 "$framework/System.Numerics.Vectors.dll",
 "$framework/System.Numerics.dll",
 "$framework/System.Windows.Forms.dll",
 "$refs/Facades/System.Runtime.dll",
 "$refs/Facades/System.Runtime.InteropServices.dll",
 "$sdk/Windows.Foundation.UniversalApiContract/12.0.0.0/Windows.Foundation.UniversalApiContract.winmd",
 "$sdk/Windows.Foundation.FoundationContract/4.0.0.0/Windows.Foundation.FoundationContract.winmd"
) | ForEach-Object { '/reference:'+$_.Replace('/','\') }
& $compiler /nologo /target:winexe /platform:x64 $referenceArgs "/out:$nativeRoot\GlassBackdrop.exe" "$nativeRoot\GlassBackdrop.cs"
if($LASTEXITCODE -ne 0){throw 'GlassBackdrop build failed'}
