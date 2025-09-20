import Link from "next/link";
import { IS_FAIR } from "@/utils/config";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar"
export default function Home() {
  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <h1 className="text-4xl">Kinetix AI</h1>
      {IS_FAIR == true ? (<><Link href={"/squats"}>Squats</Link>
        <Link href={"/pushups"}>PushUps</Link></>) : (<><Menubar>
  {/* Home - no dropdown */}
  <MenubarMenu>
    <MenubarTrigger>
      <Link href={"/"}>Home</Link>
    </MenubarTrigger>
  </MenubarMenu>

  {/* Exercise - has dropdown */}
  <MenubarMenu>
    <MenubarTrigger>Exercise</MenubarTrigger>
    <MenubarContent>
      <MenubarItem>
        <Link href={"/pushups"}>PushUps</Link>
      </MenubarItem>
      <MenubarSeparator />
      <MenubarItem>
        <Link href={"/squats"}>Squats</Link>
      </MenubarItem>
    </MenubarContent>
  </MenubarMenu>

  {/* Feedback - no dropdown */}
  <MenubarMenu>
    <MenubarTrigger>
      <Link href={"/feedback_form"}>Feedback</Link>
    </MenubarTrigger>
  </MenubarMenu>
</Menubar></>)}

    </div>
  );
}
