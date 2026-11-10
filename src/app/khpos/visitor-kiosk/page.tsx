import type { Metadata } from "next";
import { VisitorKiosk } from "@/components/khpos/VisitorKiosk";
export const metadata:Metadata={
  title:"Visitor welcome · KHP-OS",
  robots:{index:false,follow:false},
};
export default function VisitorKioskPage(){return <VisitorKiosk/>;}
