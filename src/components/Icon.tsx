import type { ComponentProps } from "preact";
import HeartIcon from "@/src/assets/heart.svg?react";
import HeartFilledIcon from "@/src/assets/heart-filled.svg?react";
import ArrowPathIcon from "@/src/assets/arrow-path.svg?react";
import CommentIcon from "@/src/assets/comment.svg?react";
import LeftArrowIcon from "@/src/assets/left-arrow.svg?react";
import RightArrowIcon from "@/src/assets/right-arrow.svg?react";
import MagnifyingIcon from "@/src/assets/magnifying.svg?react";
import CogIcon from "@/src/assets/cog.svg?react";
import XMarkIcon from "@/src/assets/x.svg?react";
import FunnelIcon from "@/src/assets/funnel.svg?react";
import RectangleStackIcon from "@/src/assets/rectangle-stack.svg?react";
import QueueListIcon from "@/src/assets/queue-list.svg?react";
import CircleIcon from "@/src/assets/circle.svg?react";
import GithubIcon from "@/src/assets/github.svg?react";
import ArrowUturnLeftIcon from "@/src/assets/arrow-uturn-left.svg?react";
import PlusCircleIcon from "@/src/assets/plus-circle.svg?react";
import MinusCircleIcon from "@/src/assets/minus-circle.svg?react";
import ChevronRightIcon from "@/src/assets/chevron-right.svg?react";
import Link from "@/src/assets/link.svg?react";

// site
import FirefoxIcon from "@/src/assets/firefox.svg?react";
import ChromeIcon from "@/src/assets/chrome.svg?react";
import User from "@/src/assets/user.svg?react";
import Video from "@/src/assets/video.svg?react";
import Phone from "@/src/assets/phone.svg?react";
import Information from "@/src/assets/information.svg?react";
import Photo from "@/src/assets/photo.svg?react";
import FaceSmile from "@/src/assets/face-smile.svg?react";
import PaperAirplane from "@/src/assets/paper-airplane.svg?react";

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
