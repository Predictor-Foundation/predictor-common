import { Tooltip } from "@mui/material";
import { formatDistanceToNowStrict } from "date-fns";
import enGB from "date-fns/locale/en-GB";
import { format as formatTime, formatInTimeZone as formatTimeInTimeZone } from "date-fns-tz";
import { useCallback, useEffect, useMemo, useState } from "react";

export type TimeProps = {
	time: string | Date | number;
	format?: string;
	fromNow?: boolean;
	utc?: boolean;
	timezone?: boolean;
	tooltip?: boolean;
};

/** Formats a timestamp - absolute, relative ("from now"), or UTC, with an optional tooltip. */
export const Time = (props: TimeProps) => {
	const {
		time,
		format: formatProp = "PP pp",
		utc = false,
		fromNow = false,
		timezone = utc,
		tooltip = false,
	} = props;

	const formatFromNow = useCallback(
		(value: string | Date | number) =>
			formatDistanceToNowStrict(new Date(value), { addSuffix: true, locale: enGB }),
		[],
	);

	const [fromNowFormatted, setFromNowFormatted] = useState<string>(formatFromNow(time));

	const formatted = useMemo(() => {
		let format = formatProp;
		if (timezone) {
			format += " (zzz)";
		}
		if (utc) {
			return formatTimeInTimeZone(new Date(time), "UTC", format, { locale: enGB });
		}
		return formatTime(new Date(time), format, { locale: enGB });
	}, [time, formatProp, utc, timezone]);

	useEffect(() => {
		if (fromNow) {
			const interval = setInterval(() => setFromNowFormatted(formatFromNow(time)));
			return () => clearInterval(interval);
		}
	}, [time, fromNow, formatFromNow]);

	const timeElement = (
		<span data-test="time" data-time-format={fromNow ? "fromNow" : utc ? "utc" : formatProp}>
			{fromNow ? fromNowFormatted : formatted}
		</span>
	);

	if (!tooltip) {
		return timeElement;
	}

	return (
		<Tooltip arrow placement="top" enterTouchDelay={0} title={formatted}>
			{timeElement}
		</Tooltip>
	);
};
