import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--obsidian)]">
      <div className="nebula-bg" />
      <SignIn />
    </div>
  );
}
