import type { ComponentProps } from 'preact';
import HeartIcon from '@/assets/heart.svg?react';
import ArrowPathIcon from '@/assets/arrow-path.svg?react';
import CommentIcon from '@/assets/comment.svg?react';

const icons = {
  heart: HeartIcon,
  arrowPath: ArrowPathIcon,
  comment: CommentIcon,
} as const;

export type IconName = keyof typeof icons;

type IconProps = Omit<ComponentProps<'svg'>, 'ref'> & {
  name: IconName;
};

export function Icon({ name, ...props }: IconProps) {
  const IconComponent = icons[name];
  if (!IconComponent) return null;
  return <IconComponent {...props} />;
} 