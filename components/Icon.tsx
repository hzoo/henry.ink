import type { ComponentProps } from "preact";
import HeartIcon from "@/assets/heart.svg?react";
import HeartFilledIcon from "@/assets/heart-filled.svg?react";
import ArrowPathIcon from "@/assets/arrow-path.svg?react";
import CommentIcon from "@/assets/comment.svg?react";
import LeftArrowIcon from "@/assets/left-arrow.svg?react";
import RightArrowIcon from "@/assets/right-arrow.svg?react";
import MagnifyingIcon from "@/assets/magnifying.svg?react";
import CogIcon from "@/assets/cog.svg?react";
import XMarkIcon from "@/assets/x.svg?react";
import FunnelIcon from "@/assets/funnel.svg?react";
import RectangleStackIcon from "@/assets/rectangle-stack.svg?react";
import QueueListIcon from "@/assets/queue-list.svg?react";
import CircleIcon from "@/assets/circle.svg?react";
import GithubIcon from "@/assets/github.svg?react";
import ArrowUturnLeftIcon from "@/assets/arrow-uturn-left.svg?react";
import PlusCircleIcon from "@/assets/plus-circle.svg?react";
import MinusCircleIcon from "@/assets/minus-circle.svg?react";
import ChevronRightIcon from "@/assets/chevron-right.svg?react";
import Link from "@/assets/link.svg?react";

// site
import FirefoxIcon from "@/assets/firefox.svg?react";
import ChromeIcon from "@/assets/chrome.svg?react";
import User from "@/assets/user.svg?react";
import Video from "@/assets/video.svg?react";
import Phone from "@/assets/phone.svg?react";
import Information from "@/assets/information.svg?react";
import Photo from "@/assets/photo.svg?react";
import FaceSmile from "@/assets/face-smile.svg?react";
import PaperAirplane from "@/assets/paper-airplane.svg?react";

const icons = {
	heart: HeartIcon,
	heartFilled: HeartFilledIcon,
	arrowPath: ArrowPathIcon,
	comment: CommentIcon,
	leftArrow: LeftArrowIcon,
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
	arrowUturnLeft: ArrowUturnLeftIcon,
	plusCircle: PlusCircleIcon,
	minusCircle: MinusCircleIcon,
	chevronRight: ChevronRightIcon,
	user: User,
	phone: Phone,
	video: Video,
	information: Information,
	photo: Photo,
	faceSmile: FaceSmile,
	send: PaperAirplane,
	link: Link,
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
