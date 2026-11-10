// Runtime guard for GitHub disposable PostgreSQL service. Never prints secrets.
import {pathToFileURL} from 'node:url';
export function assertDisposableTarget(env){
 const issues=[];
 if(env.CI!=='true')issues.push('ci_required');
 if(env.PGHOST!=='localhost'&&env.PGHOST!=='127.0.0.1')issues.push('local_pg_host_required');
 if(env.PGPORT!=='5432')issues.push('expected_port_required');
 if(env.PGDATABASE!=='build2_synthetic')issues.push('synthetic_database_required');
 if(env.PGUSER!=='postgres')issues.push('disposable_postgres_user_required');
 if(env.PGPASSWORD!=='synthetic_test_only')issues.push('synthetic_password_required');
 for(const name of ['DATABASE_URL','DIRECT_URL','SUPABASE_DB_URL','SUPABASE_DATABASE_URL','PGSERVICE','PGSERVICEFILE','PGHOSTADDR']){
  if(env[name])issues.push('forbidden_connection_override:'+name);
 }
 return {safe:issues.length===0,issues};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=assertDisposableTarget(process.env);
 console.log(JSON.stringify(result));if(!result.safe)process.exitCode=1;
}
