import Image from 'next/image';
import { cn } from '@/lib/utils';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeClassMap: Record<AvatarSize, string> = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

const sizePxMap: Record<AvatarSize, number> = {
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
};

const emojiClassMap: Record<AvatarSize, string> = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-5xl',
};

function isAvatarUrl(avatar: string): boolean {
  return avatar.startsWith('http://') || avatar.startsWith('https://');
}

interface PlayerAvatarProps {
  avatar: string;
  name: string;
  size?: AvatarSize;
  className?: string;
}

export function PlayerAvatar({ avatar, name, size = 'md', className }: PlayerAvatarProps) {
  const safeAvatar = avatar || '🙂';

  if (!isAvatarUrl(safeAvatar)) {
    return (
      <span
        aria-label={`Avatar ${name}`}
        className={cn('inline-flex items-center justify-center leading-none', emojiClassMap[size], className)}
      >
        {safeAvatar}
      </span>
    );
  }

  const px = sizePxMap[size];

  return (
    <span className={cn('relative inline-flex overflow-hidden rounded-full border border-white/20 bg-white/10', sizeClassMap[size], className)}>
      <Image
        src={safeAvatar}
        alt={`Avatar ${name}`}
        width={px}
        height={px}
        className="h-full w-full object-cover"
        unoptimized
      />
    </span>
  );
}
