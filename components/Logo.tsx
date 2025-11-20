'use client';

import Image from 'next/image';

type LogoProps = {
  width?: number;
  height?: number;
  className?: string;
};

export function Logo({ width = 170, height = 170, className = '' }: LogoProps) {
  return (
    <div className={`flex justify-center items-center ${className}`.trim()}>
      <Image
        src="/cyberscan-logo.png"
        alt="CyberScan Logo"
        width={width}
        height={height}
        className="rounded-lg"
        priority
      />
    </div>
  );
}
