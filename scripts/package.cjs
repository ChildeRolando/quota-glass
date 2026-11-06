(async()=>{
 const {packager}=await import('@electron/packager');
 const paths=await packager({dir:'.',name:'QuotaGlass',platform:'win32',arch:'x64',out:process.env.QUOTA_GLASS_OUTPUT_DIR||'dist',overwrite:true,asar:{unpack:'**/native/*.exe'},
  icon:'src/ui/app.ico',ignore:[/^\/(test|scripts|screenshots|docs|dist|outputs)(\/|$)/]});
 console.log(paths.join('\n'));
})().catch(error=>{console.error(error);process.exitCode=1;});
