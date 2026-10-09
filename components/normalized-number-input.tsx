"use client";
import {type ComponentProps} from "react";
import {Input} from "@/components/ui/input";

// React keeps some number-input strings (such as "07") in the DOM when
// Number(value) is already equal to the controlled numeric state.
export function normalizeIntegerInput(value:string){
 return value.replace(/^(-?)0+(?=\d)/,"$1");
}
export function NormalizedNumberInput({onChange,...props}:ComponentProps<typeof Input>){
 return <Input {...props} onChange={event=>{
  const current=event.currentTarget.value;
  const normalized=normalizeIntegerInput(current);
  if(normalized!==current)event.currentTarget.value=normalized;
  onChange?.(event);
 }}/>;
}
