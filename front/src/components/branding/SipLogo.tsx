import Image from "next/image";

export function SipLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex max-w-full items-center rounded-xl bg-white p-2 ${className}`}>
      <Image
        src="/sip-logo.png"
        alt="SIP Instrumentación"
        width={2000}
        height={1000}
        className="h-auto w-full object-contain"
        priority
      />
    </div>
  );
}
