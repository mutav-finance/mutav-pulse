import { redirect } from "next/navigation";
import { PRIMARY_RESERVE } from "@/lib/reserves";

export default function ProtocolIndex() {
  redirect(`/protocol/${PRIMARY_RESERVE.address}`);
}
