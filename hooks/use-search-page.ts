"use client";
import {useEffect,useState} from 'react';
/** Search criteria start a new pagination sequence; manual page changes are retained. */
export function useSearchPage(criteria:string){
 const [page,setPage]=useState(1);
 useEffect(()=>{setPage(1);},[criteria]);
 return [page,setPage] as const;
}
