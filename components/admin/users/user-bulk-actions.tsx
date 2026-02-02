"use client";

import NiceModal from "@ebay/nice-modal-react";
import type { Table } from "@tanstack/react-table";
import type * as React from "react";
import { toast } from "sonner";
import {
	CsvDelimiterModal,
	type DelimiterType,
} from "@/components/csv-delimiter-modal";
import {
	type BulkActionItem,
	DataTableBulkActions,
} from "@/components/ui/custom/data-table";
import { downloadCsv, downloadExcel } from "@/lib/utils";
import { trpc } from "@/trpc/client";

export type UserBulkActionsProps<T> = {
	table: Table<T>;
};

export function UserBulkActions<T extends { id: string }>({
	table,
}: UserBulkActionsProps<T>): React.JSX.Element {
	const exportCsv = trpc.admin.user.exportSelectedToCsv.useMutation();
	const exportExcel = trpc.admin.user.exportSelectedToExcel.useMutation();

	const getDelimiterChar = (delimiterType: DelimiterType): string => {
		switch (delimiterType) {
			case "comma":
				return ",";
			case "semicolon":
				return ";";
			case "tab":
				return "\t";
			default:
				return ",";
		}
	};

	const handleExportSelectedToCsv = async (delimiter: DelimiterType) => {
		const selectedRows = table.getSelectedRowModel().rows;
		if (selectedRows.length === 0) {
			toast.error("No users selected.");
			return;
		}
		const userIds = selectedRows.map((row) => row.original.id);
		try {
			const csv = await exportCsv.mutateAsync({ userIds });
			const delimiterChar = getDelimiterChar(delimiter);
			const csvData =
				delimiter === "comma" ? csv : csv.replace(/,/g, delimiterChar);
			downloadCsv(csvData, "users.csv");
			toast.success("CSV exported.");
		} catch (_err) {
			toast.error("Failed to export CSV.");
		}
	};

	const handleExportSelectedToExcel = async () => {
		const selectedRows = table.getSelectedRowModel().rows;
		if (selectedRows.length === 0) {
			toast.error("No users selected.");
			return;
		}
		const userIds = selectedRows.map((row) => row.original.id);
		try {
			const base64 = await exportExcel.mutateAsync({ userIds });
			downloadExcel(base64, "users.xlsx");
			toast.success("Excel exported.");
		} catch (_err) {
			toast.error("Failed to export Excel.");
		}
	};

	const actions: BulkActionItem[] = [
		{
			label: "Export to CSV",
			onClick: () => {
				NiceModal.show(CsvDelimiterModal, {
					onConfirm: handleExportSelectedToCsv,
				});
			},
		},
		{
			label: "Export to Excel",
			onClick: handleExportSelectedToExcel,
		},
	];

	return <DataTableBulkActions table={table} actions={actions} />;
}
