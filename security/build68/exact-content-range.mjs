/**
 * Strict Content-Range total parser for synthetic-only PostgREST HEAD checks.
 * The total must be a nonnegative safe integer. For an explicit row interval,
 * start <= end < total; a zero total must be represented by */0.
 * Never trust a syntactically matched but impossible HTTP range as UAT proof.
 */
export function parseExactCount(value){
 if(typeof value!=="string")return null;
 const found=/^(\*|(\d+)-(\d+))\/(\d+)$/.exec(value.trim());
 if(!found)return null;
 const total=Number(found[4]);
 if(!Number.isSafeInteger(total)||total<0)return null;
 if(found[1]==="*")return total;
 const start=Number(found[2]),end=Number(found[3]);
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||
    start<0||start>end||end>=total)return null;
 return total;
}
