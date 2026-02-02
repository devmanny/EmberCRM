import type * as React from "react";
import { appConfig } from "@/config/app.config";
import { cn } from "@/lib/utils";

export type LogoProps = {
	className?: string;
	withLabel?: boolean;
};

export function Logo({
	withLabel = true,
	className,
}: LogoProps): React.JSX.Element {
	return (
		<span
			className={cn(
				"flex items-center font-semibold text-foreground leading-none",
				className,
			)}
		>
			<div className="flex size-9 items-center justify-center p-1">
				<div className="flex size-7 items-center justify-center rounded-md border bg-primary text-primary-foreground">
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M12 2C12 2 8 8 8 12C8 14.2091 9.79086 16 12 16C14.2091 16 16 14.2091 16 12C16 8 12 2 12 2Z"
							fill="currentColor"
						/>
						<path
							d="M10 14C10 14 8.5 16 8.5 17.5C8.5 18.8807 9.61929 20 11 20C12.3807 20 13.5 18.8807 13.5 17.5C13.5 16 12 14 12 14"
							fill="currentColor"
						/>
					</svg>
				</div>
			</div>
			{withLabel && (
				<span className="ml-2 hidden font-bold text-lg md:block">
					{appConfig.appName}
				</span>
			)}
		</span>
	);
}
