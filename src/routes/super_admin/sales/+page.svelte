<script lang="ts">
	import { goto } from '$app/navigation';

	export let data;
	let loading = true;
	$: loading = data?.stats === undefined;

	let searchQuery = data.searchQuery ?? '';
	let hourStart = data.hourStart ?? 0;
	let hourEnd = data.hourEnd ?? 23;
	let searchDebounce: ReturnType<typeof setTimeout>;

	// View state
	let view: 'daily' | 'weekly' | 'monthly' | 'allTime' = (
		['daily', 'weekly', 'monthly', 'allTime'].includes(data.view ?? '') ? data.view : 'daily'
	) as 'daily' | 'weekly' | 'monthly' | 'allTime';
	let selectedDate = data.targetDate;

	$: currentPage = data.page ?? 1;
	$: totalPages = data.totalPages ?? 1;

	// Formatter for Philippine Peso
	// Postgres numeric aggregates (SUM/COUNT) come back as strings through the
	// driver even when the query is typed as number, so always coerce here.
	const formatPHP = (val: number | string) =>
		new Intl.NumberFormat('en-PH', {
			style: 'currency',
			currency: 'PHP',
			minimumFractionDigits: 2
		}).format(Number(val) || 0);

	const formatDateTime = (value: number | string) => {
		const d = new Date(typeof value === 'number' ? value * 1000 : value);
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth() + 1).padStart(2, '0');
		const dd = String(d.getDate()).padStart(2, '0');
		let hh = d.getHours();
		const min = String(d.getMinutes()).padStart(2, '0');
		const ampm = hh >= 12 ? 'PM' : 'AM';
		hh = hh % 12;
		if (hh === 0) hh = 12;
		const hhStr = String(hh).padStart(2, '0');
		return `${yyyy}-${mm}-${dd} ${hhStr}:${min} ${ampm}`;
	};

	const formatDateOnly = (value: number | string) => {
		const d = new Date(typeof value === 'number' ? value * 1000 : value);
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth() + 1).padStart(2, '0');
		const dd = String(d.getDate()).padStart(2, '0');
		return `${yyyy}-${mm}-${dd}`;
	};

	const groupSalesByDate = (rows: Array<Record<string, any>>) => {
		const groups = new Map<string, Array<Record<string, any>>>();
		for (const sale of rows) {
			const key = formatDateOnly(sale.createdAt);
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(sale);
		}
		return Array.from(groups.entries()).map(([date, sales]) => ({ date, sales }));
	};

	const paymentMethodIcon = (paymentMode: string) => {
		return paymentMode === 'CASH'
			? '💵'
			: paymentMode === 'GCASH'
				? '📱'
				: paymentMode === 'BANK'
					? '🏦'
					: '💳';
	};

	// Navigation logic
	function updateQuery() {
		const params = new URLSearchParams({ date: selectedDate, view });
		if (searchQuery.trim()) params.set('search', searchQuery.trim());
		if (hourStart !== 0) params.set('hourStart', String(hourStart));
		if (hourEnd !== 23) params.set('hourEnd', String(hourEnd));
		goto(`?${params.toString()}`);
	}

	function loadMoreSales() {
		if (currentPage >= totalPages) return;
		const params = new URLSearchParams({
			date: selectedDate,
			view,
			page: String(currentPage + 1)
		});
		if (searchQuery.trim()) params.set('search', searchQuery.trim());
		if (hourStart !== 0) params.set('hourStart', String(hourStart));
		if (hourEnd !== 23) params.set('hourEnd', String(hourEnd));
		goto(`?${params.toString()}`);
	}

	function handleSearchInput() {
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(updateQuery, 400);
	}

	const handleDateChange = () => updateQuery();

	const resetToToday = () => {
		selectedDate = new Date().toISOString().split('T')[0];
		updateQuery();
	};

	// Calculate Gross (Revenue before discounts)
	let currentStats: { total: number; count: number; totalDiscount: number } = {
		total: 0,
		count: 0,
		totalDiscount: 0
	};
	$: {
		const stat = data.stats[view];
		currentStats = Array.isArray(stat) ? (stat[0] ?? { total: 0, count: 0, totalDiscount: 0 }) : stat;
	}
	$: grossRevenue = (Number(currentStats?.total) || 0) + (Number(currentStats?.totalDiscount) || 0);
	$: groupedSales = groupSalesByDate(data?.recentSales ?? []);

	// Payment method breakdown for the currently selected view/date/hour/search
	// filters. Prefers the server-computed totals (period-accurate, matches
	// currentStats), falling back to counting whatever sales rows are
	// currently loaded on the page if the server hasn't sent paymentTotals.
	type PaymentTotal = { total: number; count: number };
	const PAYMENT_ORDER = ['CASH', 'GCASH', 'BANK'];
	$: paymentTotals = Array.isArray(data?.paymentTotals)
		? (data.paymentTotals as Array<{ paymentMode: string; total: number; count: number }>).reduce(
				(acc: Record<string, PaymentTotal>, row) => {
					const mode = (row.paymentMode || 'OTHER').toUpperCase();
					acc[mode] = { total: Number(row.total) || 0, count: Number(row.count) || 0 };
					return acc;
				},
				{} as Record<string, PaymentTotal>
			)
		: (data?.recentSales ?? []).reduce(
				(acc: Record<string, PaymentTotal>, sale: any) => {
					const mode = (sale.paymentMode || 'OTHER').toUpperCase();
					if (!acc[mode]) acc[mode] = { total: 0, count: 0 };
					acc[mode].total += Number(sale.totalPrice) || 0;
					acc[mode].count += 1;
					return acc;
				},
				{} as Record<string, PaymentTotal>
			);
	$: paymentTotalsArePeriodAccurate = Array.isArray(data?.paymentTotals);
	$: orderedPaymentEntries = [
		...PAYMENT_ORDER.filter((m) => paymentTotals[m]).map(
			(m) => [m, paymentTotals[m]] as [string, PaymentTotal]
		),
		...Object.entries(paymentTotals).filter(([m]) => !PAYMENT_ORDER.includes(m)) as [
			string,
			PaymentTotal
		][]
	];
	const paymentBadgeClass = (mode: string) => {
		const m = mode.toUpperCase();
		return m === 'CASH' || m === 'GCASH' || m === 'BANK' || m === 'CARD'
			? m.toLowerCase()
			: 'other';
	};
</script>

<div class="dashboard">
	<header class="dash-header">
		<div class="title-area">
			<h1>Sales Report</h1>
			<div class="current-date-badge">📅 {data.dateRangeLabel}</div>
			<div class="page-badge">Page {currentPage} of {totalPages}</div>
		</div>

		<div class="filter-area">
			<div class="date-input-wrapper">
				<input type="date" bind:value={selectedDate} on:change={handleDateChange} />
			</div>

			<input
				type="text"
				class="search-input"
				placeholder="Search product…"
				bind:value={searchQuery}
				on:input={handleSearchInput}
			/>

			<div class="hour-range">
				<select bind:value={hourStart} on:change={updateQuery}>
					{#each Array(24) as _, h}
						<option value={h}>{String(h).padStart(2, '0')}:00</option>
					{/each}
				</select>
				<span>to</span>
				<select bind:value={hourEnd} on:change={updateQuery}>
					{#each Array(24) as _, h}
						<option value={h}>{String(h).padStart(2, '0')}:59</option>
					{/each}
				</select>
			</div>

			<div class="toggle-pill">
				<button
					class:active={view === 'daily'}
					on:click={() => {
						view = 'daily';
						updateQuery();
					}}>Day</button
				>
				<button
					class:active={view === 'weekly'}
					on:click={() => {
						view = 'weekly';
						updateQuery();
					}}>Week</button
				>
				<button
					class:active={view === 'monthly'}
					on:click={() => {
						view = 'monthly';
						updateQuery();
					}}>Month</button
				>
				<button
					class:active={view === 'allTime'}
					on:click={() => {
						view = 'allTime';
						updateQuery();
					}}>All</button
				>
			</div>
		</div>
	</header>

	{#if loading}
		<div class="metrics-grid">
			<div class="metric-card skeleton-card">
				<div class="skeleton-line skeleton-line-sm"></div>
				<div class="skeleton-line skeleton-line-lg"></div>
				<div class="skeleton-line skeleton-line-md"></div>
			</div>
			<div class="metric-card skeleton-card">
				<div class="skeleton-line skeleton-line-sm"></div>
				<div class="skeleton-line skeleton-line-lg"></div>
				<div class="skeleton-line skeleton-line-md"></div>
			</div>
		</div>

		<section class="table-container">
			<div class="table-header">
				<h3>Transaction Breakdown</h3>
			</div>
			<div class="scroll-box">
				<table>
					<thead>
						<tr>
							<th>Time</th>
							<th>Product Details</th>
							<th>Color/Size</th>
							<th>Unit Price</th>
							<th>Qty</th>
							<th>Discount</th>
							<th>Payment Method</th>
							<th>Final Total</th>
						</tr>
					</thead>
					<tbody>
						{#each Array(6) as _}
							<tr class="skeleton-row">
								{#each Array(8) as __}
									<td><div class="skeleton-bar"></div></td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{:else}
		<div class="metrics-grid">
			<div class="metric-card primary">
				<span class="label">{view} Net Revenue</span>
				<h2 class="value">{formatPHP(currentStats.total || 0)}</h2>
				<div class="metric-footer">
					<span class="sub">{currentStats.count} items sold</span>
					<span class="gross-hint">Gross: {formatPHP(grossRevenue || 0)}</span>
				</div>
			</div>

			<div class="metric-card discount-card">
				<span class="label">Total Discount</span>
				<h2 class="value text-red">-{formatPHP(currentStats.totalDiscount || 0)}</h2>
				<p class="sub">Total discounts granted in this period</p>
			</div>
		</div>

		<div class="payment-summary">
			{#each orderedPaymentEntries as [mode, totals]}
				<div class="payment-summary-item {paymentBadgeClass(mode)}">
					<span class="payment-summary-icon">{paymentMethodIcon(mode)}</span>
					<div class="payment-summary-text">
						<span class="payment-summary-label">{mode}</span>
						<span class="payment-summary-value">{formatPHP(totals.total)}</span>
					</div>
					<span class="payment-summary-count">{totals.count}×</span>
				</div>
			{:else}
				<div class="payment-summary-empty">No transactions loaded yet.</div>
			{/each}
		</div>
		{#if !paymentTotalsArePeriodAccurate}
			<p class="payment-summary-note">
				Showing totals for loaded transactions only — refresh the server data to see the full
				period.
			</p>
		{/if}

		<section class="table-container">
			<div class="table-header">
				<h3>Transaction Breakdown</h3>
			</div>

			<div class="scroll-box">
				<table>
					<thead>
						<tr>
							<th>Time</th>
							<th>Product Details</th>
							<th>Color/Size</th>
							<th>Unit Price</th>
							<th>Qty</th>
							<th>Discount</th>
							<th>Payment Method</th>
							<th>Final Total</th>
						</tr>
					</thead>
					<tbody>
						{#if groupedSales.length === 0}
							<tr>
								<td colspan="8" class="empty-state">
									<div class="empty-content">
										<span class="icon">🚫</span>
										<p>No sales records found for this selection.</p>
										<button class="reset-btn" on:click={resetToToday}>Return to Today</button>
									</div>
								</td>
							</tr>
						{:else}
							{#each groupedSales as group}
								<tr class="date-row">
									<td colspan="8">Date: {group.date}</td>
								</tr>
								{#each group.sales as sale}
									<tr>
										<td data-label="Time" class="time">{formatDateTime(sale.createdAt)}</td>
										<td data-label="Product">
											<span class="prod-name">{sale.productName}</span>
										</td>
										<td data-label="Color/Size">
											<span class="tag">{sale.color || 'N/A'}</span>
											<span class="tag">{sale.size || 'N/A'}</span>
										</td>
										<td data-label="Unit Price" class="applied">{formatPHP(sale.appliedPrice || 0)}</td>
										<td data-label="Qty">{sale.quantity}</td>
										<td data-label="Discount">
											{#if sale.adjustment > 0}
												<span class="discount-pill">−{formatPHP(sale.adjustment || 0)}</span>
											{:else}
												<span class="no-discount">No Discount Added</span>
											{/if}
										</td>
										<td data-label="Payment">
											<span class="payment-badge {sale.paymentMode.toLowerCase()}">
												<span class="payment-emoji">{paymentMethodIcon(sale.paymentMode)}</span>
												<span class="payment-text">{sale.paymentMode}</span>
											</span>
										</td>
										<td data-label="Total" class="total-col">{formatPHP(sale.totalPrice || 0)}</td>
									</tr>
								{/each}
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</section>

		{#if currentPage < totalPages}
			<div class="load-more-wrap">
				<button class="load-more-btn" on:click={loadMoreSales}>Load More Transactions</button>
				<p class="load-more-meta">Page {currentPage} of {totalPages}</p>
			</div>
		{:else}
			<div class="load-more-wrap">
				<p class="load-more-meta">All transactions loaded. Page {currentPage} of {totalPages}</p>
			</div>
		{/if}
	{/if}
</div>

<style>
	:global(body) {
		background-color: #f8fafc;
	}

	.dashboard {
		width: 100%;
		max-width: 100%;
		box-sizing: border-box;
		font-family: 'Inter', system-ui, sans-serif;
	}

	/* Header */
	.dash-header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 2rem;
	}
	.title-area {
		min-width: 0;
	}
	h1 {
		font-size: 1.5rem;
		font-weight: 800;
		color: #0f172a;
		margin: 0;
	}
	.current-date-badge {
		color: #64748b;
		font-size: 0.875rem;
		margin-top: 4px;
	}
	.page-badge {
		margin-top: 4px;
		font-size: 0.8rem;
		font-weight: 600;
		color: #0f172a;
	}

	.filter-area {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}
	input[type='date'],
	.search-input {
		padding: 0.5rem 0.75rem;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		background: white;
		font-weight: 500;
		color: #1e293b;
		font-size: 0.875rem;
	}
	.search-input {
		min-width: 0;
		width: 180px;
	}

	.hour-range {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: #64748b;
	}
	.hour-range select {
		padding: 0.45rem 0.5rem;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		background: white;
		font-size: 0.8rem;
		color: #1e293b;
	}

	.toggle-pill {
		background: #f1f5f9;
		padding: 4px;
		border-radius: 10px;
		display: flex;
		flex-wrap: wrap;
		border: 1px solid #e2e8f0;
	}
	.toggle-pill button {
		border: none;
		background: none;
		padding: 6px 16px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		border-radius: 7px;
		color: #64748b;
		transition: all 0.2s;
	}
	.toggle-pill button.active {
		background: white;
		color: #0f172a;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	/* Metrics */
	.metrics-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		margin-bottom: 2rem;
	}
	.metric-card {
		background: white;
		padding: 1.5rem;
		border-radius: 16px;
		border: 1px solid #e2e8f0;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
		min-width: 0;
	}
	.metric-card.primary {
		border-left: 6px solid #10b981;
	}
	.metric-card.discount-card {
		border-left: 6px solid #ef4444;
	}

	.label {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #94a3b8;
	}
	.value {
		font-size: 2.25rem;
		margin: 0.5rem 0;
		font-weight: 800;
		color: #1e293b;
	}
	.text-red {
		color: #ef4444 !important;
	}

	.metric-footer {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}
	.sub {
		font-size: 0.8rem;
		color: #64748b;
	}
	.gross-hint {
		font-size: 0.8rem;
		color: #94a3b8;
		font-weight: 600;
	}

	/* Table container */
	.table-container {
		background: white;
		border-radius: 16px;
		border: 1px solid #e2e8f0;
		overflow: hidden;
	}
	.table-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid #e2e8f0;
	}
	.table-header h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		color: #0f172a;
	}

	.scroll-box {
		width: 100%;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: thin;
		scrollbar-color: #cbd5e1 transparent;
	}
	.scroll-box::-webkit-scrollbar {
		height: 8px;
	}
	.scroll-box::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 8px;
	}
	.scroll-box::-webkit-scrollbar-track {
		background: transparent;
	}
	table {
		width: 100%;
		min-width: 760px;
		border-collapse: collapse;
	}
	th {
		text-align: left;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #94a3b8;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #e2e8f0;
		white-space: nowrap;
	}
	td {
		padding: 0.85rem 1rem;
		font-size: 0.875rem;
		color: #1e293b;
		border-bottom: 1px solid #f1f5f9;
		vertical-align: middle;
	}

	tr.date-row td {
		background: #f8fafc;
		font-weight: 700;
		font-size: 0.75rem;
		color: #64748b;
		padding: 0.5rem 1rem;
	}

	.time {
		white-space: nowrap;
		color: #64748b;
		font-size: 0.8rem;
	}
	.prod-name {
		font-weight: 600;
	}
	.tag {
		display: inline-block;
		background: #f1f5f9;
		color: #475569;
		font-size: 0.7rem;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 6px;
		margin-right: 4px;
	}
	.applied {
		white-space: nowrap;
	}
	.total-col {
		font-weight: 800;
		white-space: nowrap;
	}
	.discount-pill {
		color: #ef4444;
		font-weight: 600;
		font-size: 0.8rem;
	}
	.no-discount {
		color: #94a3b8;
		font-size: 0.75rem;
	}

	.payment-badge {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 700;
		white-space: nowrap;
	}
	.payment-badge.cash {
		background: #dcfce7;
		color: #16a34a;
	}
	.payment-badge.gcash {
		background: #dbeafe;
		color: #2563eb;
	}
	.payment-badge.bank {
		background: #fef3c7;
		color: #b45309;
	}
	.payment-badge.card {
		background: #ede9fe;
		color: #7c3aed;
	}

	/* Payment totals summary — grid so each method gets its own fixed-size
	   box and wraps onto a new row instead of stretching into one long line */
	.payment-summary {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}
	.payment-summary-item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 0.75rem 1rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
		min-width: 0;
	}
	.payment-summary-icon {
		font-size: 1.25rem;
		line-height: 1;
	}
	.payment-summary-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.payment-summary-label {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #94a3b8;
	}
	.payment-summary-value {
		font-size: 1rem;
		font-weight: 800;
		color: #1e293b;
		white-space: nowrap;
	}
	.payment-summary-count {
		margin-left: auto;
		font-size: 0.7rem;
		font-weight: 700;
		color: #94a3b8;
		white-space: nowrap;
	}
	.payment-summary-item.cash {
		border-left: 4px solid #16a34a;
	}
	.payment-summary-item.gcash {
		border-left: 4px solid #2563eb;
	}
	.payment-summary-item.bank {
		border-left: 4px solid #b45309;
	}
	.payment-summary-item.card {
		border-left: 4px solid #7c3aed;
	}
	.payment-summary-item.other {
		border-left: 4px solid #64748b;
	}
	.payment-summary-empty {
		font-size: 0.8rem;
		color: #94a3b8;
	}
	.payment-summary-note {
		margin: -1rem 0 1.5rem;
		font-size: 0.72rem;
		color: #94a3b8;
		font-style: italic;
	}

	.empty-state {
		text-align: center;
		padding: 3rem 1rem !important;
	}
	.empty-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}
	.empty-content .icon {
		font-size: 2rem;
	}
	.empty-content p {
		color: #64748b;
		margin: 0;
	}
	.reset-btn {
		margin-top: 0.5rem;
		border: 1px solid #e2e8f0;
		background: white;
		border-radius: 8px;
		padding: 0.5rem 1rem;
		font-weight: 600;
		font-size: 0.8rem;
		cursor: pointer;
		color: #1e293b;
	}

	.load-more-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1.5rem 0;
	}
	.load-more-btn {
		border: 1px solid #e2e8f0;
		background: white;
		border-radius: 10px;
		padding: 0.7rem 1.5rem;
		font-weight: 700;
		font-size: 0.85rem;
		cursor: pointer;
		color: #1e293b;
	}
	.load-more-meta {
		font-size: 0.75rem;
		color: #94a3b8;
		margin: 0;
	}

	/* Skeleton loading state */
	.skeleton-card {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.skeleton-line {
		background: #e2e8f0;
		border-radius: 6px;
		animation: pulse 1.4s ease-in-out infinite;
	}
	.skeleton-line-sm {
		width: 40%;
		height: 10px;
	}
	.skeleton-line-lg {
		width: 60%;
		height: 28px;
	}
	.skeleton-line-md {
		width: 50%;
		height: 12px;
	}
	.skeleton-bar {
		width: 100%;
		height: 14px;
		background: #e2e8f0;
		border-radius: 4px;
		animation: pulse 1.4s ease-in-out infinite;
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	/* ===== Responsive: layout wraps, table stays a real table and
	   scrolls horizontally at every width (including small control panels) ===== */
	@media (max-width: 768px) {
		.metrics-grid {
			grid-template-columns: 1fr;
		}
		.search-input {
			width: 100%;
			flex: 1 1 160px;
		}
		.filter-area {
			width: 100%;
		}

		.empty-state {
			display: block !important;
		}
		.empty-content {
			padding: 1rem 0;
		}
	}

	@media (max-width: 480px) {
		.value {
			font-size: 1.75rem;
		}
		.payment-summary {
			grid-template-columns: 1fr;
		}
		.toggle-pill {
			width: 100%;
			justify-content: space-between;
		}
		.toggle-pill button {
			flex: 1;
			padding: 6px 8px;
		}
		.hour-range {
			width: 100%;
			justify-content: space-between;
		}
		.hour-range select {
			flex: 1;
		}
		th,
		td {
			font-size: 0.8rem;
		}
		.payment-text {
			display: none;
		}
		.payment-badge {
			padding: 4px 8px;
		}
	}
</style>