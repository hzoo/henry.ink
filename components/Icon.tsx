import type { ComponentProps } from 'preact';
import HeartIcon from '@/assets/heart.svg?react';
import HeartFilledIcon from '@/assets/heart-filled.svg?react';
import ArrowPathIcon from '@/assets/arrow-path.svg?react';
import CommentIcon from '@/assets/comment.svg?react';
import RightArrowIcon from '@/assets/right-arrow.svg?react';
import MagnifyingIcon from '@/assets/magnifying.svg?react';
import CogIcon from '@/assets/cog.svg?react';
import XMarkIcon from '@/assets/x.svg?react';
import FunnelIcon from '@/assets/funnel.svg?react';
import RectangleStackIcon from '@/assets/rectangle-stack.svg?react';
import QueueListIcon from '@/assets/queue-list.svg?react';
import CircleIcon from '@/assets/circle.svg?react';
import FirefoxIcon from '@/assets/firefox.svg?react';
import ChromeIcon from '@/assets/chrome.svg?react';
import GithubIcon from '@/assets/github.svg?react';

const icons = {
  heart: HeartIcon,
  heartFilled: HeartFilledIcon,
  arrowPath: ArrowPathIcon,
  comment: CommentIcon,
  rightArrow: RightArrowIcon,
  magnifying: MagnifyingIcon,
  cog: CogIcon,
  xMark: XMarkIcon,
  funnel: FunnelIcon,
  rectangleStack: RectangleStackIcon,
  queueList: QueueListIcon,
  circle: CircleIcon,
  firefox: FirefoxIcon,
  chrome: ChromeIcon,
  github: GithubIcon,
} as const;

export type IconName = keyof typeof icons;

type IconProps = {
  name: IconName;
} & ComponentProps<typeof HeartIcon>;

export function Icon({ name, ...props }: IconProps) {
  const IconComponent = icons[name];
  if (!IconComponent) return null;
  return <IconComponent {...props} />;
} 