/**
 * Build66: accepts only a Supabase publishable key or legacy JWT anon role.
 * Prevent accidentally testing RLS through privileged or service-role keys.
 * Does not verify the legacy JWT signature: hosted API authenticates it.
 * Never log, serialize or return any API key.
 */
export function assertUnprivilegedUatKey(key){
 if(typeof key!=="string"||!key.trim())throw new Error("UAT API key missing");
 if(key.startsWith("sb_publishable_"))return;
 if(key.startsWith("sb_secret_")||key.startsWith("sb_service_role_"))
   throw new Error("privileged UAT API key forbidden");
 const parts=key.split(".");
 if(parts.length!==3)throw new Error("unrecognized nonproduction publishable key");
 let role;
 try{role=JSON.parse(Buffer.from(parts[1],"base64url").toString("utf8")).role}
 catch{throw new Error("invalid legacy nonproduction key")}
 if(role!=="anon")throw new Error("non-anonymous JWT API key forbidden");
}
