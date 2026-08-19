<script lang="ts">
	import { onMount, afterUpdate } from "svelte";
	import { goto, invalidateAll } from "$app/navigation";
	import Chart from "chart.js/auto";
	import LoginHistory from "$lib/components/LoginHistory.svelte";

	export let data: any;
	let loading = true;
	$: loading = data?.stats === undefined || data?.chartData === undefined;

	let revenueCanvas: HTMLCanvasElement;
	let topProductsCanvas: HTMLCanvasElement;
	let charts: Chart[] = [];
	let showLowStockModal = false;
	let selectedBrand = "all";
	let brandDropdownOpen = false;

	$: brandOptions = data?.lowStockItems
	? (Array.from(
			new Set(
				data.lowStockItems.map((i: any) => String(i.brand)).filter(Boolean),
			),
		) as string[]).sort()
	: [];

	$: filteredLowStock =
		selectedBrand === "all"
			? data.lowStockItems
			: data.lowStockItems.filter((i: any) => i.brand === selectedBrand);

	$: if (selectedBrand !== "all" && !brandOptions.includes(selectedBrand)) {
		selectedBrand = "all";
	}

	function selectBrand(brand: string) {
		selectedBrand = brand;
		brandDropdownOpen = false;
	}

	function closeBrandDropdown() {
		brandDropdownOpen = false;
	}
	const colors = {
		revenue: "#2563eb",
		primary: "#2563eb",
		secondary: "#7c3aed",
	};

	const fmt = (v: number) =>
		new Intl.NumberFormat("en-PH", {
			style: "currency",
			currency: "PHP",
		}).format(v);

	let lastUpdated = new Date().toLocaleTimeString();

	onMount(() => {
		initCharts();

		const interval = setInterval(
			async () => {
				await invalidateAll();
				lastUpdated = new Date().toLocaleTimeString();
				console.log("Dashboard Synced at:", lastUpdated);
			},
			1000 * 60 * 2,
		);

		return () => {
			clearInterval(interval);
			destroyCharts();
		};
	});

	afterUpdate(() => {
		destroyCharts();
		initCharts();
	});

	function destroyCharts() {
		charts.forEach((c) => c.destroy());
		charts = [];
	}

	function initCharts() {
		if (!data.chartData || !data.chartData.labels.length) return;

		const baseOptions = {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: { display: false },
			},
			scales: {
				x: { grid: { display: false }, ticks: { font: { size: 11 } } },
				y: {
					grid: { color: "#f3f4f6" },
					beginAtZero: true,
					ticks: { font: { size: 11 } },
				},
			},
		};

		// 1. Revenue Flow (Line)
		if (revenueCanvas) {
			charts.push(
				new Chart(revenueCanvas, {
					type: "line",
					data: {
						labels: data.chartData.labels,
						datasets: [
							{
								label: "Revenue",
								data: data.chartData.revenue,
								borderColor: colors.revenue,
								backgroundColor: "rgba(37,99,235,0.1)",
								fill: true,
								tension: 0.4,
								pointRadius: 4,
							},
						],
					},
					options: baseOptions,
				}),
			);
		}

		// 2. Top 10 Sellers (Horizontal Bar)
		if (topProductsCanvas && data.topSellingProducts.length > 0) {
			charts.push(
				new Chart(topProductsCanvas, {
					type: "bar",
					data: {
						labels: data.topSellingProducts.map((p: any) => p.name),
						datasets: [
							{
								label: "Sold",
								data: data.topSellingProducts.map(
									(p: any) => p.sold,
								),
								backgroundColor: colors.revenue,
								borderRadius: 6,
							},
						],
					},
					options: {
						...baseOptions,
						indexAxis: "y",
						scales: {
							x: { grid: { display: false } },
							y: { grid: { display: false } },
						},
					},
				}),
			);
		}
	}
</script>

<div class="app-layout">
	<main class="dashboard-content">
		<header class="dashboard-header">
			<div class="header-text">
				<h1>Dashboard</h1>
				<div class="breadcrumb">Analytics / Overview</div>
			</div>

			<div class="header-controls">
				<div class="filter-dropdown-box">
					<select
						class="filter-select"
						value={data.activeFilter}
						on:change={(e) =>
							goto(`?filter=${e.currentTarget.value}`)}
					>
						<option value="daily">This Day</option>
						<option value="weekly">This Week</option>
						<option value="monthly">This Month</option>
						<option value="yearly">This Year</option>
					</select>

					<div class="select-icon">
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<polyline points="6 9 12 15 18 9"></polyline>
						</svg>
					</div>
				</div>

				{#if data.stats.lowStockCount > 0}
					<button
						class="btn-alert"
						on:click={() => (showLowStockModal = true)}
					>
						<div class="pulse-dot-alert"></div>
						<span>{data.stats.lowStockCount} Alerts</span>
					</button>
				{/if}
			</div>
		</header>

		{#if loading}
			<section class="metrics-grid">
				{#each Array(4) as _}
					<div class="metric-card skeleton-card">
						<div class="skeleton-line skeleton-line-sm"></div>
						<div class="skeleton-line skeleton-line-lg"></div>
						<div class="skeleton-line skeleton-line-md"></div>
					</div>
				{/each}
			</section>

			<section class="charts-layout">
				{#each Array(3) as _}
					<div class="chart-card skeleton-card">
						<div class="skeleton-line skeleton-line-sm"></div>
						<div class="skeleton-box"></div>
					</div>
				{/each}
			</section>
		{:else}
			<section class="metrics-grid">
				<div class="metric-card">
					<div class="card-head">
						<div class="icon-box blue">💰</div>
						<div
							class="trend-pill"
							class:neg={data.stats.salesChange < 0}
						>
							{data.stats.salesChange >= 0 ? "↑" : "↓"}
							{Math.abs(data.stats.salesChange)}%
						</div>
					</div>
					<div class="card-body">
						<p class="label">Total Revenue</p>
						<h3>{fmt(data.stats.totalSales)}</h3>
						<p class="sub-label">
							vs previous {data.activeFilter === "daily"
								? "day"
								: data.activeFilter === "weekly"
									? "week"
									: data.activeFilter === "monthly"
										? "month"
										: "year"}
						</p>
					</div>
				</div>

				<div class="metric-card dark">
					<div class="card-head">
						<div class="icon-box gray">📦</div>
					</div>
					<div class="card-body">
						<p class="label">Product Capital</p>
						<h3>{fmt(data.stats.stockCost)}</h3>
						<p class="sub-label opacity-60">
							Inventory value at sale
						</p>
					</div>
				</div>

				<div class="metric-card">
					<div class="card-head">
						<div class="icon-box red">🧾</div>
						<div
							class="trend-pill"
							class:neg={data.stats.expChange > 0}
							class:pos={data.stats.expChange <= 0}
						>
							{data.stats.expChange > 0 ? "↑" : "↓"}
							{Math.abs(data.stats.expChange)}%
						</div>
					</div>
					<div class="card-body">
						<p class="label">Shop Expenses</p>
						<h3>{fmt(data.stats.shopExpenses)}</h3>
						<p class="sub-label">Utilities, rent, & maintenance</p>
					</div>
				</div>

				<div class="metric-card success">
					<div class="card-head">
						<div class="icon-box green">📈</div>
						<div class="margin-badge">
							{data.stats.totalSales > 0
								? (
										(data.stats.netProfit /
											data.stats.totalSales) *
										100
									).toFixed(0)
								: 0}% Margin
						</div>
					</div>
					<div class="card-body">
						<p class="label">Net Profit</p>
						<h3 class="text-emerald">
							{fmt(data.stats.netProfit)}
						</h3>
						<p class="sub-label">Take-home earnings</p>
					</div>
				</div>
			</section>

			<section class="charts-layout">
				<div class="chart-card">
					<div class="chart-header-row">
						<div>
							<h4>Revenue Trend</h4>
							<p class="subtitle">Real-time performance</p>
						</div>
					</div>
					<div class="canvas-wrapper">
						<canvas bind:this={revenueCanvas}></canvas>
					</div>
				</div>

				<div class="chart-card span-2">
					<div class="chart-header">
						<div class="header-left">
							<h4>Top 10 Performing Products</h4>
							<p class="subtitle">Ranked by units sold</p>
						</div>

						<div class="sync-status">
							<div class="pulse-container">
								<div class="pulse-dot"></div>
								<div class="pulse-ring"></div>
							</div>
							<span class="sync-text"
								>LATEST SYNC: {lastUpdated}</span
							>
						</div>
					</div>

					{#if data.topSellingProducts.length === 0}
						<div class="empty-state">No sales in this period</div>
					{:else}
						<div class="canvas-wrapper large">
							<canvas bind:this={topProductsCanvas}></canvas>
						</div>
					{/if}
				</div>

				<div class="chart-card">
					<div>
						<h4>Payment Methods</h4>
						<p class="subtitle">Transaction distribution</p>
					</div>
					<div class="payment-stack">
						{#each data.paymentBreakdown as pay}
							<div class="pay-item">
								<div class="pay-info">
									<span
										class="dot"
										style="background: {pay.mode === 'Cash'
											? colors.primary
											: colors.secondary}"
									></span>
									<span class="name">{pay.mode}</span>
								</div>
								<span class="value">{fmt(pay.total)}</span>
							</div>
						{/each}
					</div>
				</div>
			</section>
		{/if}
	</main>
</div>

{#if showLowStockModal}
	<div
		class="modal-backdrop"
		role="button"
		aria-label="Close inventory alerts modal"
		tabindex="0"
		on:click|self={() => (showLowStockModal = false)}
		on:keydown={(e) => {
			if (e.key === "Escape" || e.key === "Enter" || e.key === " ")
				showLowStockModal = false;
		}}
	>
		<div class="modal-box">
			<div class="modal-header">
				<h3>Inventory Alerts</h3>
				<p>Items currently below safety levels.</p>

				{#if brandOptions.length > 1}
					<div class="brand-filter-box">
						<button
							type="button"
							class="brand-filter-trigger"
							on:click={() =>
								(brandDropdownOpen = !brandDropdownOpen)}
						>
							<span
								>{selectedBrand === "all"
									? "All Brands"
									: selectedBrand}</span
							>
							<svg
								width="12"
								height="12"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class:rotated={brandDropdownOpen}
							>
								<polyline points="6 9 12 15 18 9"></polyline>
							</svg>
						</button>

						{#if brandDropdownOpen}
							<div
								class="brand-dropdown-backdrop"
								role="presentation"
								on:click={closeBrandDropdown}
							></div>
							<div class="brand-dropdown-list">
								<button
									type="button"
									class="brand-option"
									class:active={selectedBrand === "all"}
									on:click={() => selectBrand("all")}
								>
									All Brands
								</button>
								{#each brandOptions as brand}
									<button
										type="button"
										class="brand-option"
										class:active={selectedBrand === brand}
										on:click={() => selectBrand(brand)}
									>
										{brand}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<div class="modal-content">
				{#if filteredLowStock.length === 0}
					<div class="modal-empty">
						No low stock items for this brand
					</div>
				{:else}
					{#each filteredLowStock as item}
						<div class="alert-row">
							<span class="alert-name">
								{item.name}
								{#if item.color || item.size}
									<span class="alert-meta">
										{item.color || "N/A"}{item.size
											? ` / ${item.size}`
											: ""}
									</span>
								{/if}
							</span>
							<span class="stock-tag">{item.stock} left</span>
						</div>
					{/each}
				{/if}
			</div>
			<button
				class="btn-close"
				on:click={() => (showLowStockModal = false)}
				>Close Report</button
			>
		</div>
	</div>
{/if}

<LoginHistory />

<style>
	:global(body) {
		margin: 0;
		font-family:
			"Inter",
			-apple-system,
			sans-serif;
		background: #f8fafc;
	}

	.app-layout {
		min-height: 100vh;
		color: #0f172a;
	}

	.dashboard-content {
		margin: 0 auto;
		padding: 2rem; /* Default desktop padding */
		max-width: 1400px; /* Good practice for ultra-wide screens */
		width: 100%;
		box-sizing: border-box; /* Include padding in width calculation */
	}

	/* --- Typography & Header --- */
	.breadcrumb {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #94a3b8;
		margin-bottom: 0.5rem;
	}

	.dashboard-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		margin-bottom: 2.5rem;
	}

	h1 {
		font-size: 1.875rem;
		font-weight: 800;
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	/* --- Controls & Buttons --- */
	.header-controls {
		display: flex;
		gap: 1rem;
	}

	/* --- Dropdown Filter --- */
	.filter-dropdown-box {
		position: relative;
		display: inline-block;
		/* min-width: 100px; */
	}

	.filter-select {
		appearance: none;
		-webkit-appearance: none;
		width: 100%;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 10px 36px 10px 16px;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		color: #0f172a;
		cursor: pointer;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
	}

	.filter-select:focus {
		outline: none;
		border-color: #94a3b8;
		box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.05);
	}

	.select-icon {
		position: absolute;
		right: 14px;
		top: 50%;
		transform: translateY(-50%);
		pointer-events: none; /* Lets clicks pass through to the select */
		color: #64748b;
		display: flex;
		align-items: center;
	}

	.btn-alert {
		background: #fff;
		border: 1px solid #fee2e2;
		color: #ef4444;
		padding: 0 16px;
		border-radius: 12px;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		transition: background 0.2s;
	}

	.btn-alert:hover {
		background: #fef2f2;
	}

	.pulse-dot-alert {
		width: 8px;
		height: 8px;
		background: #ef4444;
		border-radius: 50%;
		animation: pulse 2s infinite;
	}

	/* --- Grid Layouts --- */
	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(4, 5fr);
		gap: 1.5rem;
		margin-bottom: 2.5rem;
		width: 100%;
	}

	/* Stack in single column for very small screens */
	@media (max-width: 350px) {
		.metrics-grid {
			grid-template-columns: 1fr;
		}
	}

	.charts-layout {
		display: grid;
		grid-template-columns: 1fr; /* Default to 1 column for mobile/tablet */
		gap: 1rem;
		width: 100%;
	}

	/* --- Cards --- */
	.metric-card,
	.chart-card,
	.skeleton-card {
		background: white;
		border-radius: 20px;
		border: 1px solid #e2e8f0;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
		min-width: 0; /* Allows card to shrink below content size */
		overflow: hidden; /* Prevents overflow on small screens */
	}

	.metric-card {
		padding: 1.5rem;
	}

	.metric-card.success {
		background: #ecfdf5;
		border: 1px solid #d1fae5;
	}

	.chart-card {
		padding: 1.75rem;
		border-radius: 24px;
		min-width: 0;
	}

	.card-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.25rem;
		gap: 0.5rem;
		min-width: 0; /* Allow flex items to shrink */
	}

	.icon-box {
		width: 40px;
		height: 40px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		flex-shrink: 0; /* Prevent icon from shrinking */
	}

	.icon-box.blue {
		background: #eff6ff;
	}
	.icon-box.green {
		background: #dcfce7;
	}
	.icon-box.red {
		background: #fff1f2;
	}
	.icon-box.gray {
		background: #f1f5f9;
	}

	.trend-pill {
		font-size: 0.75rem;
		font-weight: 700;
		padding: 4px 10px;
		border-radius: 20px;
		background: #f0fdf4;
		color: #166534;
	}

	.trend-pill.neg {
		background: #fef2f2;
		color: #991b1b;
	}

	.card-body .label {
		font-size: 0.875rem;
		color: #64748b;
		margin: 0 0 0.5rem 0;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-body h3 {
		font-size: 1.75rem;
		margin: 0;
		font-weight: 800;
		letter-spacing: -0.02em;
		word-break: break-word;
		overflow: hidden;
	}

	.card-body .sub-label {
		font-size: 0.75rem;
		color: #94a3b8;
		margin: 0.5rem 0 0 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.text-emerald {
		color: #059669;
	}

	/* --- Chart Elements --- */
	h4 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 700;
		color: #1e293b;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.subtitle {
		font-size: 0.815rem;
		color: #64748b;
		margin: 0.25rem 0 1.5rem 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.canvas-wrapper {
		height: 240px;
		position: relative;
		width: 100%; /* Ensures responsiveness */
		min-width: 0; /* Allow wrapper to shrink */
	}

	.canvas-wrapper.large {
		height: 350px;
	}

	.chart-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 20px;
		flex-wrap: wrap; /* Allows wrapping on tight screens */
		gap: 10px;
	}

	.sync-status {
		display: flex;
		align-items: center;
		gap: 8px;
		background-color: #f1f5f9;
		padding: 5px 12px;
		border-radius: 100px;
		border: 1px solid #e2e8f0;
	}

	.sync-text {
		font-size: 10px;
		font-weight: 700;
		color: #475569;
		letter-spacing: 0.03em;
		font-family: ui-monospace, SFMono-Regular, monospace;
	}

	.pulse-container {
		position: relative;
		width: 8px;
		height: 8px;
	}

	.pulse-dot,
	.pulse-ring {
		position: absolute;
		width: 8px;
		height: 8px;
		background-color: #10b981;
		border-radius: 50%;
	}

	.pulse-ring {
		animation: pulse-animation 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	/* --- Lists & Empty States --- */
	.empty-state {
		height: 240px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #94a3b8;
		font-style: italic;
		background: #f8fafc;
		border-radius: 12px;
	}

	.payment-stack {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.pay-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: #f8fafc;
		border-radius: 12px;
	}

	.brand-filter-box {
		margin-top: 0.75rem;
	}

	.brand-filter-box {
		position: relative;
		margin-top: 0.75rem;
	}

	.brand-filter-trigger {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		padding: 8px 14px;
		font-family: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		color: #0f172a;
		cursor: pointer;
	}

	.brand-filter-trigger svg {
		flex-shrink: 0;
		color: #64748b;
		transition: transform 0.15s ease;
	}

	.brand-filter-trigger svg.rotated {
		transform: rotate(180deg);
	}

	.brand-dropdown-backdrop {
		position: fixed;
		inset: 0;
		z-index: 150;
	}

	.brand-dropdown-list {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		max-height: 240px;
		overflow-y: auto;
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
		z-index: 151;
		padding: 6px;
	}

	.brand-option {
		display: block;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		padding: 10px 12px;
		font-family: inherit;
		font-size: 0.8rem;
		font-weight: 500;
		color: #0f172a;
		border-radius: 8px;
		cursor: pointer;
	}

	.brand-option:hover {
		background: #f1f5f9;
	}

	.brand-option.active {
		background: #eff6ff;
		color: #2563eb;
		font-weight: 700;
	}

	.modal-empty {
		padding: 2rem 0;
		text-align: center;
		color: #94a3b8;
		font-style: italic;
		font-size: 0.85rem;
	}
	.pay-info {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.name {
		font-weight: 600;
		font-size: 0.9rem;
	}

	.value {
		font-weight: 700;
		color: #1e293b;
	}

	/* --- Modal --- */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.7);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 1rem; /* Prevents edge-touching on mobile */
	}

	.modal-box {
		background: white;
		padding: 2rem;
		border-radius: 24px;
		width: 100%;
		max-width: 450px; /* Limits size on desktop, fluid on mobile */
		max-height: 90vh; /* Prevents overflow off-screen */
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}

	.modal-content {
		overflow-y: auto;
		padding-right: 8px;
		flex-grow: 1;
	}

	.alert-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 0;
		border-bottom: 1px solid #f1f5f9;
	}

	.alert-name {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-weight: 600;
	}

	.alert-meta {
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.stock-tag {
		color: #ef4444;
		background: #fef2f2;
		padding: 4px 12px;
		border-radius: 8px;
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.btn-close {
		width: 100%;
		margin-top: 1.5rem;
		padding: 14px;
		background: #0f172a;
		color: white;
		border: none;
		border-radius: 12px;
		cursor: pointer;
		font-weight: 700;
	}

	/* --- Skeletons --- */
	.skeleton-card {
		padding: 1.75rem;
	}
	.skeleton-line,
	.skeleton-box {
		background: linear-gradient(
			90deg,
			#f1f5f9 25%,
			#e2e8f0 50%,
			#f1f5f9 75%
		);
		background-size: 200% 100%;
		animation: skeleton-shimmer 1.5s infinite linear;
		border-radius: 8px;
	}
	.skeleton-line-sm {
		height: 12px;
		width: 40%;
		margin-bottom: 12px;
	}
	.skeleton-line-md {
		height: 12px;
		width: 60%;
	}
	.skeleton-line-lg {
		height: 22px;
		width: 70%;
		margin-bottom: 12px;
	}
	.skeleton-box {
		height: 220px;
	}

	/* --- Animations --- */
	@keyframes skeleton-shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}
	@keyframes pulse-animation {
		0% {
			transform: scale(1);
			opacity: 0.8;
		}
		100% {
			transform: scale(3.5);
			opacity: 0;
		}
	}
	@keyframes pulse {
		0% {
			box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
		}
		70% {
			box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
		}
	}

	/* =========================================
       RESPONSIVE BREAKPOINTS
       ========================================= */

	/* 14" 16:10 laptops (1920x1200 and similar) */
	@media (max-width: 1920px) and (max-height: 1200px) {
		h1 {
			font-size: 1.6rem;
		}

		h4 {
			font-size: 1rem;
		}

		.subtitle {
			font-size: 0.8rem;
		}

		.metric-card h3 {
			font-size: 1.6rem;
		}

		.card-body .label {
			font-size: 0.8rem;
		}

		.canvas-wrapper {
			height: 220px;
		}

		.canvas-wrapper.large {
			height: 320px;
		}
	}

	/* Smaller 14" 16:10 laptops (1680x1050, 1440x900) */
	@media (max-width: 1680px) {
		.dashboard-content {
			padding: 1.75rem;
		}

		h1 {
			font-size: 1.5rem;
		}

		.breadcrumb {
			font-size: 0.7rem;
		}

		h4 {
			font-size: 1rem;
		}

		.subtitle {
			font-size: 0.8rem;
		}

		.metric-card {
			padding: 1.25rem;
		}

		.metric-card h3 {
			font-size: 1.5rem;
		}

		.card-body .label {
			font-size: 0.8rem;
		}

		.card-body .sub-label {
			font-size: 0.7rem;
		}

		.chart-card {
			padding: 1.5rem;
		}

		.canvas-wrapper {
			height: 200px;
		}

		.canvas-wrapper.large {
			height: 300px;
		}

		.metrics-grid {
			gap: 1.25rem;
		}

		.charts-layout {
			gap: 1rem;
		}
	}

	/* Very small 14" 16:10 (1440x900, 1280x800) */
	@media (max-width: 1440px) {
		.dashboard-content {
			padding: 1.5rem;
		}

		h1 {
			font-size: 1.4rem;
		}

		.breadcrumb {
			font-size: 0.68rem;
		}

		h4 {
			font-size: 0.95rem;
		}

		.subtitle {
			font-size: 0.75rem;
			margin: 0.2rem 0 1.2rem 0;
		}

		.metric-card {
			padding: 1.1rem;
		}

		.metric-card h3 {
			font-size: 1.4rem;
		}

		.card-body .label {
			font-size: 0.75rem;
			margin-bottom: 0.4rem;
		}

		.card-body .sub-label {
			font-size: 0.68rem;
			margin-top: 0.4rem;
		}

		.chart-card {
			padding: 1.25rem;
		}

		.canvas-wrapper {
			height: 180px;
		}

		.canvas-wrapper.large {
			height: 280px;
		}

		.metrics-grid {
			gap: 1rem;
			margin-bottom: 2rem;
		}

		.charts-layout {
			gap: 0.75rem;
		}

		.filter-select {
			padding: 8px 32px 8px 14px;
			font-size: 0.8rem;
		}

		.btn-alert {
			padding: 8px 12px;
			font-size: 0.8rem;
		}
	}

	/* Small laptops (1280px and below) */
	@media (max-width: 1280px) {
		.dashboard-content {
			padding: 1.5rem 1rem;
		}

		h1 {
			font-size: 1.3rem;
		}

		.breadcrumb {
			font-size: 0.65rem;
		}

		.metrics-grid {
			grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
			gap: 0.75rem;
			margin-bottom: 1.5rem;
		}

		.metric-card {
			padding: 1rem;
		}

		.metric-card h3 {
			font-size: 1.3rem;
		}

		.card-head {
			margin-bottom: 1rem;
		}

		.icon-box {
			width: 36px;
			height: 36px;
			font-size: 1.1rem;
		}

		.chart-card {
			padding: 1.25rem;
		}

		h4 {
			font-size: 0.9rem;
			margin: 0;
		}

		.subtitle {
			font-size: 0.7rem;
			margin: 0.15rem 0 1rem 0;
		}

		.canvas-wrapper {
			height: 160px;
		}

		.canvas-wrapper.large {
			height: 260px;
		}
	}

	@media (max-width: 1024px) {
		.dashboard-content {
			padding: 1.25rem 1rem;
		}

		h1 {
			font-size: 1.25rem;
		}

		.breadcrumb {
			font-size: 0.65rem;
		}

		.dashboard-header {
			margin-bottom: 1.75rem;
		}

		.metrics-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 0.75rem;
			margin-bottom: 1.5rem;
		}

		.charts-layout {
			grid-template-columns: 1fr;
		}

		/* ONLY apply span-2 on desktop. On mobile, this broke the layout! */
		.span-2 {
			grid-column: span 1;
		}

		.metric-card {
			padding: 0.9rem;
		}

		.metric-card h3 {
			font-size: 1.2rem;
		}

		.card-body .label {
			font-size: 0.7rem;
		}

		.card-body .sub-label {
			font-size: 0.65rem;
		}

		.chart-card {
			padding: 1.1rem;
		}

		h4 {
			font-size: 0.9rem;
		}

		.subtitle {
			font-size: 0.7rem;
			margin: 0.15rem 0 1rem 0;
		}

		.canvas-wrapper {
			height: 200px;
		}

		.canvas-wrapper.large {
			height: 200px;
		}

		.chart-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.75rem;
		}

		.sync-status {
			font-size: 9px;
			padding: 4px 10px;
		}

		.sync-text {
			font-size: 8px;
		}
	}

	/* =========================================
       MOBILE & TABLET OVERRIDES
       ========================================= */
	@media (max-width: 768px) {
		.dashboard-content {
			padding: 1rem 0.75rem;
			max-width: 100%;
		}

		.dashboard-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.75rem;
			margin-bottom: 1.25rem;
		}

		h1 {
			font-size: 1.1rem;
			font-weight: 700;
			margin: 0;
		}

		.breadcrumb {
			font-size: 0.6rem;
			margin-bottom: 0.3rem;
		}

		.header-controls {
			width: 100%;
			display: flex;
			flex-direction: row;
			gap: 0.5rem;
			flex-wrap: wrap;
		}

		.filter-dropdown-box {
			flex: 1;
			min-width: 130px;
		}

		.filter-select {
			padding: 7px 24px 7px 11px;
			font-size: 0.72rem;
			width: 100%;
		}

		.btn-alert {
			flex: 0 0 auto;
			padding: 7px 10px;
			font-size: 0.7rem;
			white-space: nowrap;
		}

		/* Metrics: 2 columns on tablets */
		.metrics-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 0.5rem;
			margin-bottom: 1.25rem;
			width: 100%;
		}

		.metric-card {
			padding: 0.75rem;
		}

		.metric-card h3 {
			font-size: 0.95rem;
		}

		.card-head {
			margin-bottom: 0.6rem;
			gap: 0.5rem;
		}

		.icon-box {
			width: 30px;
			height: 30px;
			font-size: 0.95rem;
			flex-shrink: 0;
		}

		.card-body .label {
			font-size: 0.62rem;
			margin-bottom: 0.25rem;
		}

		.card-body .sub-label {
			font-size: 0.58rem;
			margin-top: 0.25rem;
		}

		.trend-pill {
			font-size: 0.6rem;
			padding: 2px 6px;
		}

		.margin-badge {
			font-size: 0.6rem;
			padding: 2px 6px;
		}

		/* Charts: Single column, reduced heights */
		.charts-layout {
			grid-template-columns: 1fr;
			gap: 0.6rem;
			width: 100%;
		}

		.chart-card {
			padding: 0.85rem;
			border-radius: 14px;
		}

		h4 {
			font-size: 0.85rem;
			margin: 0 0 0.2rem 0;
		}

		.subtitle {
			font-size: 0.62rem;
			margin: 0.05rem 0 0.8rem 0;
		}

		.canvas-wrapper {
			height: 160px;
		}

		.canvas-wrapper.large {
			height: 160px;
		}

		.chart-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
			margin-bottom: 0.75rem;
		}

		.chart-header-row {
			width: 100%;
		}

		.sync-status {
			font-size: 7px;
			padding: 3px 7px;
			gap: 4px;
		}

		.sync-text {
			font-size: 7px;
		}

		.pulse-container {
			width: 6px;
			height: 6px;
		}

		.pulse-dot,
		.pulse-ring {
			width: 6px;
			height: 6px;
		}

		.payment-stack {
			gap: 0.6rem;
		}

		.pay-item {
			padding: 0.75rem;
			font-size: 0.8rem;
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.pay-info {
			gap: 0.6rem;
		}

		.name {
			font-size: 0.78rem;
		}

		.value {
			font-size: 0.78rem;
			align-self: flex-end;
			margin-top: -1.5rem;
		}

		.empty-state {
			height: 160px;
			padding: 1.5rem;
			font-size: 0.85rem;
		}

		/* Modal improvements */
		.modal-backdrop {
			padding: 0.75rem;
		}

		.modal-box {
			padding: 1rem;
			max-width: 95vw;
			border-radius: 16px;
		}

		.modal-header {
			margin-bottom: 0.85rem;
		}

		.modal-header h3 {
			font-size: 1rem;
			margin-bottom: 0.3rem;
		}

		.modal-header p {
			font-size: 0.75rem;
			margin: 0;
		}

		.modal-content {
			max-height: 60vh;
		}

		.alert-row {
			padding: 0.75rem 0;
			gap: 0.5rem;
		}

		.alert-name {
			font-size: 0.8rem;
			gap: 2px;
		}

		.alert-meta {
			font-size: 0.7rem;
		}

		.stock-tag {
			font-size: 0.7rem;
			padding: 2px 8px;
		}

		.btn-close {
			padding: 10px;
			font-size: 0.8rem;
			margin-top: 1rem;
		}
	}

	@media (max-width: 600px) {
		.dashboard-content {
			padding: 0.75rem 0.5rem;
		}

		.dashboard-header {
			gap: 0.5rem;
			margin-bottom: 1rem;
		}

		h1 {
			font-size: 1rem;
		}

		.breadcrumb {
			font-size: 0.55rem;
		}

		.header-controls {
			gap: 0.4rem;
		}

		.filter-select {
			padding: 6px 20px 6px 10px;
			font-size: 0.68rem;
		}

		.btn-alert {
			padding: 6px 8px;
			font-size: 0.65rem;
		}

		.metrics-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 0.4rem;
			margin-bottom: 1rem;
		}

		.metric-card {
			padding: 0.6rem;
		}

		.metric-card h3 {
			font-size: 0.9rem;
		}

		.card-body .label {
			font-size: 0.6rem;
		}

		.card-body .sub-label {
			font-size: 0.55rem;
		}

		.charts-layout {
			gap: 0.5rem;
		}

		.chart-card {
			padding: 0.75rem;
		}

		h4 {
			font-size: 0.8rem;
		}

		.subtitle {
			font-size: 0.6rem;
			margin: 0.05rem 0 0.7rem 0;
		}

		.canvas-wrapper {
			height: 140px;
		}

		.canvas-wrapper.large {
			height: 140px;
		}

		.payment-stack {
			gap: 0.5rem;
		}

		.pay-item {
			padding: 0.6rem;
			font-size: 0.75rem;
		}

		.modal-box {
			max-width: 98vw;
			padding: 0.85rem;
		}

		.modal-header h3 {
			font-size: 0.95rem;
		}

		.modal-header p {
			font-size: 0.7rem;
		}

		.alert-name {
			font-size: 0.75rem;
		}

		.stock-tag {
			font-size: 0.65rem;
			padding: 2px 6px;
		}

		.btn-close {
			padding: 8px;
			font-size: 0.75rem;
		}
	}

	@media (max-width: 480px) {
		.dashboard-content {
			padding: 0.5rem 0.4rem;
		}

		.dashboard-header {
			gap: 0.4rem;
			margin-bottom: 0.85rem;
		}

		h1 {
			font-size: 0.95rem;
		}

		.breadcrumb {
			font-size: 0.52rem;
		}

		.header-controls {
			gap: 0.35rem;
		}

		.filter-select {
			padding: 5px 18px 5px 9px;
			font-size: 0.65rem;
		}

		.btn-alert {
			padding: 5px 7px;
			font-size: 0.62rem;
		}

		.metrics-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 0.2rem;
			margin-bottom: 0.85rem;
		}

		.metric-card {
			padding: 0.55rem;
		}

		.metric-card h3 {
			font-size: 0.85rem;
		}

		.icon-box {
			width: 28px;
			height: 28px;
			font-size: 0.9rem;
		}

		.card-body .label {
			font-size: 0.58rem;
		}

		.card-body .sub-label {
			font-size: 0.52rem;
		}

		.charts-layout {
			gap: 0.4rem;
		}

		.chart-card {
			padding: 0.65rem;
			border-radius: 12px;
		}

		h4 {
			font-size: 0.75rem;
		}

		.subtitle {
			font-size: 0.55rem;
			margin: 0.03rem 0 0.6rem 0;
		}

		.canvas-wrapper {
			height: 120px;
		}

		.canvas-wrapper.large {
			height: 120px;
		}

		.empty-state {
			height: 120px;
			padding: 1rem;
			font-size: 0.8rem;
		}

		.payment-stack {
			gap: 0.4rem;
		}

		.pay-item {
			padding: 0.5rem;
			font-size: 0.7rem;
		}

		.modal-box {
			max-width: 99vw;
			padding: 0.75rem;
		}

		.modal-header h3 {
			font-size: 0.9rem;
		}

		.modal-header p {
			font-size: 0.65rem;
		}

		.alert-row {
			padding: 0.6rem 0;
		}

		.alert-name {
			font-size: 0.7rem;
		}

		.stock-tag {
			font-size: 0.6rem;
			padding: 2px 5px;
		}

		.btn-close {
			padding: 8px;
			font-size: 0.7rem;
		}
	}
</style>
