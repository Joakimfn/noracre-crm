"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
type Request=(url:string,init?:RequestInit)=>Promise<Response>;
/** Ignore results and errors that belong to a superseded country, query or tenant. */
export function useRegistryLookup<T>(request:Request,country:string,query:string,organizationId?:number,includeEnk=false){
 const [results,setResults]=useState<T[]>([]),[busy,setBusy]=useState(false),[searched,setSearched]=useState(false);
 const sequence=useRef(0),key=JSON.stringify([country,query,organizationId,includeEnk]),latestKey=useRef(key);
 latestKey.current=key;
 const clear=useCallback(()=>{sequence.current++;setResults([]);setBusy(false);setSearched(false);},[]);
 useEffect(()=>{clear();},[key,clear]);
 useEffect(()=>()=>{sequence.current++;},[]);
 async function search():Promise<boolean>{
  if(!query.trim())return false;
  const token=++sequence.current,current=()=>token===sequence.current&&key===latestKey.current;
  setBusy(true);setSearched(false);
  try{
   const parameters=new URLSearchParams({q:query.trim(),country});if(includeEnk)parameters.set('includeEnk','1');
   const response=await request('/api/company-lookup?'+parameters,{headers:organizationId?{'x-organization-id':String(organizationId)}:{}}).catch(()=>{throw new Error('Kunne ikke søke i foretaksregisteret');});
   const raw:unknown=await response.json();
   if(!current())return false;
   const payload=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
   if(!response.ok)throw new Error(typeof payload.error==='string'?payload.error:'Kunne ikke søke i foretaksregisteret');
   if(!Array.isArray(payload.companies))throw new Error('Kunne ikke søke i foretaksregisteret');
   setResults(payload.companies as T[]);setSearched(true);return true;
  }catch(error){if(!current())return false;setResults([]);throw error;}
  finally{if(current())setBusy(false);}
 }
 return {results,busy,searched,search,clear};
}
