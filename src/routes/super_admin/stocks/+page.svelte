<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { browser } from '$app/environment';
	import JsBarcode from 'jsbarcode';
	import { tick } from 'svelte';
	import { supabase } from '$lib/supabase';

	let products: any[] = [];
	let categoriesList: any[] = [];
	let loading = true;
	let showModal = false;
	let productToDelete: any = null;
	let sortField = 'quantity';
	let sortDirection = -1;
	let searchQuery = '';
	let selectedProduct: any = null;
	let selectedCategoryFilter = '';
	let toast = { show: false, message: '', type: 'success' as 'success' | 'error' };

	let realtimeStatus = 'connecting';

	onMount(() => {
		console.info('[renderer] products page mounted');
		loadInitialData(); // your existing call

		// ✅ Realtime — refresh when any PC changes products
		const channel = supabase
			.channel('admin-products-realtime')
			.on(
				'postgres_changes',
				{
					event: '*', // INSERT, UPDATE, DELETE
					schema: 'public',
					table: 'products'
				},
				async (payload) => {
					console.log('[Realtime] Product changed:', payload);
					// Silent refresh: fetch new products, update products array, do not show loading
					try {
						const { getApiBaseUrl } = await import('$lib/utils/apiBase');
						const prodRes = await fetch(getApiBaseUrl() + '/api/products');
						if (prodRes.ok) {
							const newProducts = await prodRes.json();
							products = [...newProducts]; // force Svelte reactivity
						} else {
							console.error('[products] silent fetch failed', {
								endpoint: '/api/products',
								status: prodRes.status,
								statusText: prodRes.statusText
							});
						}
					} catch (err) {
						console.error('[products] silent refresh error', err);
					}
				}
			)
			.subscribe((status) => {
				realtimeStatus = status;
				console.log('[Realtime] Channel status:', status);
			});

		return () => supabase.removeChannel(channel);
	});

	let form = {
		id: null as number | null,
		// SKU REMOVED FROM HERE
		name: '',
		brand: '',
		categoryId: '',
		barcode: '',
		color: '',
		size: '',
		price: 0,
		cost: 0,
		quantity: 0,
		quantity_to_add: 0
	};

	let barcodeSvg: SVGSVGElement;

	$: if (selectedProduct) {
		if (barcodeSvg && selectedProduct.barcode) {
			JsBarcode(barcodeSvg, selectedProduct.barcode);
		}
	}

	// --- SKU AUTO-GENERATION BLOCK REMOVED ---

	function showToast(message: string, type: 'success' | 'error' = 'success') {
		toast = { show: true, message, type };
		setTimeout(() => (toast.show = false), 3000);
	}

	// --- FILTER & SORT ---
	$: displayedProducts = (products || [])
		.filter((p) => {
			const search = searchQuery.toLowerCase();
			// Find the category name for this product
			const categoryName = categoriesList.find((cat) => cat.id === p.categoryId)?.name || '';
			// Combine all searchable fields into one string
			const searchable = [
				p.name,
				p.brand,
				categoryName,
				String(p.price),
				String(p.cost),
				p.color,
				p.size
			]
				.map((v) => String(v ?? '').toLowerCase())
				.join(' ');

			const matchesSearch = search === '' || searchable.includes(search);
			const matchesCategory =
				selectedCategoryFilter === '' || String(p.categoryId) === String(selectedCategoryFilter);

			return matchesSearch && matchesCategory;
		})
		.sort((a, b) => {
			const valA = a[sortField] ?? 0;
			const valB = b[sortField] ?? 0;
			if (typeof valA === 'string') return valA.localeCompare(valB) * sortDirection;
			return valA < valB ? -1 * sortDirection : 1 * sortDirection;
		});

	function toggleSort(field: string) {
		if (sortField === field) {
			sortDirection *= -1;
		} else {
			sortField = field;
			sortDirection = -1;
		}
	}
	async function openBarcode(product: any) {
		selectedProduct = product;

		await tick();

		if (barcodeSvg && selectedProduct.barcode) {
			JsBarcode(barcodeSvg, selectedProduct.barcode, {
				format: 'CODE128',
				width: 2,
				height: 80,
				displayValue: false
			});
		}
	}
	onMount(loadInitialData);
	onMount(() => {
		console.info('[renderer] products page mounted');
	});

	async function loadInitialData() {
		loading = true;
		try {
			const { getApiBaseUrl } = await import('$lib/utils/apiBase');
			const [prodRes, catRes] = await Promise.all([
				fetch(getApiBaseUrl() + '/api/products'),
				fetch(getApiBaseUrl() + '/api/categories')
			]);

			if (prodRes.ok) {
				const newProducts = await prodRes.json();
				// Force Svelte reactivity by assigning a new array reference
				products = [...newProducts];
			} else {
				console.error('[products] fetch failed', {
					endpoint: '/api/products',
					status: prodRes.status,
					statusText: prodRes.statusText
				});
			}
			if (catRes.ok) {
				categoriesList = await catRes.json();
			} else {
				console.error('[categories] fetch failed', {
					endpoint: '/api/categories',
					status: catRes.status,
					statusText: catRes.statusText
				});
			}
		} catch (err) {
			console.error(err);
			showToast('Failed to load data', 'error');
		} finally {
			loading = false;
		}
	}
	// --- MODAL LOGIC ---
	// Unique brand list for autocomplete
	$: brandSuggestions = Array.from(new Set(products.map((p) => p.brand).filter(Boolean))).sort();
	const normalizeText = (v: unknown) =>
		String(v ?? '')
			.trim()
			.toLowerCase();

	async function renderBarcodePreview(code: string) {
		if (!browser || !code) return;
		const { default: JsBarcode } = await import('jsbarcode');
		const canvas = document.getElementById('barcode-canvas') as HTMLCanvasElement;
		if (!canvas) return;
		try {
			JsBarcode(canvas, code, {
				format: 'CODE128',
				width: 2,
				height: 50,
				displayValue: true,
				fontSize: 12,
				margin: 8
			});
		} catch (e) {
			console.warn('Barcode render failed:', e);
		}
	}

	// Auto-render preview whenever barcode value changes
	$: if (showModal && form.barcode) {
		renderBarcodePreview(form.barcode);
	}

	function closeBarcodeModal() {
		selectedProduct = null;
	}
	function handleGlobalKeydown(e: any) {
		if (e.key === 'Escape' && selectedProduct) {
			closeBarcodeModal();
		}
	}
	function copyBarcode() {
		navigator.clipboard.writeText(selectedProduct.barcode);
	}

	// Calculate total inventory cost
	$: totalInventoryCost = displayedProducts.reduce((sum, p) => sum + p.cost * p.quantity, 0);
	$: totalInventoryValue = displayedProducts.reduce((sum, p) => sum + p.price * p.quantity, 0);
	$: totalProfit = totalInventoryValue - totalInventoryCost;
</script>

<svelte:window on:keydown={handleGlobalKeydown} />
<div class="header-section">
	<div>
		<h1 class="main-title">Products</h1>

		<p class="subtitle">
			JJGapo Product Management
			<span
				class="pulse-dot {realtimeStatus === 'SUBSCRIBED' ? 'green' : 'red'}"
				title={realtimeStatus}
			></span>
		</p>
		<!-- Minimal realtime status dot with tooltip -->
	</div>

	<div class="header-controls">
		<div class="search-wrapper">
			<svg
				class="search-icon"
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"
				></line></svg
			>
			<input
				type="text"
				class="minimal-input"
				placeholder="Search products or categories..."
				bind:value={searchQuery}
			/>
		</div>

		<select class="minimal-select" bind:value={selectedCategoryFilter}>
			<option value="">All Categories</option>
			{#each categoriesList as cat}<option value={cat.id}>{cat.name}</option>{/each}
		</select>
	</div>
</div>

<div class="summary-cards">
	<div class="summary-card">
		<div class="summary-label">Total Inventory Cost</div>
		<div class="summary-value">
			₱{totalInventoryCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
		</div>
		<div class="summary-subtext">{displayedProducts.length} products</div>
	</div>
	<div class="summary-card">
		<div class="summary-label">Total Inventory Value</div>
		<div class="summary-value sale">
			₱{totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
		</div>
		<div class="summary-subtext">at current prices</div>
	</div>
	<div class="summary-card">
		<div class="summary-label">Total Profit Potential</div>
		<div class="summary-value profit">
			₱{totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
		</div>
		<div class="summary-subtext">
			{((totalProfit / totalInventoryCost) * 100).toFixed(1)}% margin
		</div>
	</div>
</div>

<div class="table-container">
	{#if loading || displayedProducts.length > 0}
		<table>
			<thead>
				<tr>
					<th
						on:click={() => toggleSort('name')}
						on:keydown={(e) => e.key === 'Enter' && toggleSort('name')}
						role="columnheader"
						tabindex="0"
						aria-sort={sortField === 'name'
							? sortDirection === -1
								? 'descending'
								: 'ascending'
							: 'none'}
						class="sortable {sortField === 'name' ? 'active-column' : ''}"
					>
						Product/Brand {sortField === 'name' ? (sortDirection === -1 ? '▼' : '▲') : '↕'}
					</th>
					<th>Color</th>
					<th
						on:click={() => toggleSort('categoryId')}
						on:keydown={(e) => e.key === 'Enter' && toggleSort('categoryId')}
						role="columnheader"
						tabindex="0"
						aria-sort={sortField === 'categoryId'
							? sortDirection === -1
								? 'descending'
								: 'ascending'
							: 'none'}
						class="sortable {sortField === 'categoryId' ? 'active-column' : ''}"
					>
						Category {sortField === 'categoryId' ? (sortDirection === -1 ? '▼' : '▲') : '↕'}
					</th>
					<th>Size</th>
					<th
						on:click={() => toggleSort('cost')}
						on:keydown={(e) => e.key === 'Enter' && toggleSort('cost')}
						role="columnheader"
						tabindex="0"
						aria-sort={sortField === 'cost'
							? sortDirection === -1
								? 'descending'
								: 'ascending'
							: 'none'}
						class="sortable {sortField === 'cost' ? 'active-column' : ''}"
					>
						Unit Price {sortField === 'cost' ? (sortDirection === -1 ? '▼' : '▲') : '↕'}
					</th>
					<th
						on:click={() => toggleSort('price')}
						on:keydown={(e) => e.key === 'Enter' && toggleSort('price')}
						role="columnheader"
						tabindex="0"
						aria-sort={sortField === 'price'
							? sortDirection === -1
								? 'descending'
								: 'ascending'
							: 'none'}
						class="sortable {sortField === 'price' ? 'active-column' : ''}"
					>
						SRP {sortField === 'price' ? (sortDirection === -1 ? '▼' : '▲') : '↕'}
					</th>
					<th>Barcode</th>
					<th
						on:click={() => toggleSort('quantity')}
						on:keydown={(e) => e.key === 'Enter' && toggleSort('quantity')}
						role="columnheader"
						tabindex="0"
						aria-sort={sortField === 'quantity'
							? sortDirection === -1
								? 'descending'
								: 'ascending'
							: 'none'}
						class="sortable {sortField === 'quantity' ? 'active-column' : ''}"
					>
						Quantity {sortField === 'quantity' ? (sortDirection === -1 ? '▼' : '▲') : '↕'}
					</th>
				</tr>
			</thead>
			<tbody>
				{#if loading}
					{#each Array(8) as _}
						<tr class="skeleton-row">
							{#each Array(8) as __}
								<td data-label=""><div class="skeleton-bar"></div></td>
							{/each}
						</tr>
					{/each}
				{:else}
					{#each displayedProducts as p}
						<tr transition:fade>
							<td data-label="Product">
								<div class="p-name">{p.name}</div>
								<div
									class="p-sku"
									style="font-size: 0.7rem; color: #64748b; font-family: monospace;"
								>
									{p.brand}
								</div>
							</td>
							<td data-label="Color">
								<div class="color-indicator">
									{#if p.color}
										<span class="dot" style="background-color: {p.color};"></span>
										<span class="text-dim">{p.color}</span>
									{:else}
										<span class="text-dim">—</span>
									{/if}
								</div>
							</td>
							<td data-label="Category">
								<span class="text-dim">
									{categoriesList.find((cat) => cat.id === p.categoryId)?.name || 'Uncategorized'}
								</span>
							</td>
							<td data-label="Size"><span class="text-dim">{p.size || '—'}</span></td>
							<td data-label="Cost">
								<span class="cost-text"
									>₱{p.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span
								>
							</td>
							<td data-label="Price">
								<span class="price-text"
									>₱{p.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span
								>
							</td>
							<td data-label="Barcode" >
								<button type="button" class="barcode-btn" on:click={() => openBarcode(p)}>
									{p.barcode}
								</button>
							</td>
							<td data-label="Quantity">
								<span class="qty-text" class:low={p.quantity < 5}>
									{p.quantity} <small>pcs</small>
								</span>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	{:else}
		<div class="empty-state" transition:fade>
			<div class="empty-icon">📦</div>
			<h2>No products found</h2>
			<p>
				{#if searchQuery || selectedCategoryFilter}
					No products match your current filters. Try clearing your search.
				{:else}
					Your inventory is currently empty. Start by adding your first product.
				{/if}
			</p>
		</div>
	{/if}
</div>
{#if selectedProduct}
	<div class="modal-backdrop" on:click={closeBarcodeModal} role="presentation">
		<section
			class="modal-card"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			on:click|stopPropagation
			on:keydown|stopPropagation
		>
			<div class="modal-header">
				<div class="modal-title">{selectedProduct.name}</div>
				<button type="button" class="btn-close" on:click={closeBarcodeModal} aria-label="Close">
					✕
				</button>
			</div>

			<div class="barcode-box">
				<svg bind:this={barcodeSvg}></svg>
				<div class="barcode-number">
					{selectedProduct.barcode}
				</div>
			</div>
		</section>
	</div>
{/if}

{#if toast.show}
	<div class="snackbar" transition:fade>{toast.message}</div>
{/if}

<style>
	.main-title {
		font-size: 1.75rem;
		font-weight: 800;
		margin: 0;
		color: #0f172a;
	}
	.subtitle {
		font-size: 0.85rem;
		color: #94a3b8;
		margin: 2px 0 0 0;
	}

	.pulse-dot {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		margin-left: 8px;
		vertical-align: middle;
		cursor: pointer;
		border: 1.5px solid #fff;
		box-shadow: 0 0 0 rgba(16, 185, 129, 0.4);
		animation: pulse-green 2s infinite;
	}
	.pulse-dot.red {
		background: #ef4444;
		box-shadow: 0 0 0 rgba(239, 68, 68, 0.4);
		animation: pulse-red 2s infinite;
	}
	.pulse-dot.green {
		background: #10b981;
		box-shadow: 0 0 0 rgba(16, 185, 129, 0.4);
		animation: pulse-green 2s infinite;
	}
	@keyframes pulse-green {
		0% {
			box-shadow: 0 0 0 0px rgba(16, 185, 129, 0.7);
		}
		70% {
			box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
		}
		100% {
			box-shadow: 0 0 0 0px rgba(16, 185, 129, 0);
		}
	}
	@keyframes pulse-red {
		0% {
			box-shadow: 0 0 0 0px rgba(239, 68, 68, 0.7);
		}
		70% {
			box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
		}
		100% {
			box-shadow: 0 0 0 0px rgba(239, 68, 68, 0);
		}
	}

	.header-section {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 20px;
		gap: 1rem;
	}
	.header-controls {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.search-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.summary-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 16px;
		margin-bottom: 24px;
	}

	.summary-card {
		background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 20px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
		transition: all 0.2s ease;
	}

	.summary-card:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
		border-color: #cbd5e1;
		transform: translateY(-2px);
	}

	.summary-label {
		font-size: 0.85rem;
		color: #64748b;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 8px;
	}

	.summary-value {
		font-size: 1.8rem;
		font-weight: 800;
		color: #1e293b;
		margin-bottom: 6px;
	}

	.summary-value.sale {
		color: #059669;
	}

	.summary-value.profit {
		color: #0014c5;
	}

	.summary-subtext {
		font-size: 0.75rem;
		color: #94a3b8;
		font-weight: 500;
	}

	.search-icon {
		position: absolute;
		left: 10px;
		color: #94a3b8;
		pointer-events: none;
		font-size: 1.1rem;
	}
	.search-wrapper input {
		padding: 8px 12px 8px 36px;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		width: 220px;
		font-size: 0.85rem;
		outline: none;
		background: white;
	}
	.search-wrapper input:focus {
		border-color: #0014c5;
	}
	.minimal-input {
		padding-left: 32px;
		border: 1px solid #e2e8f0;
		padding-top: 8px;
		padding-bottom: 8px;
		padding-right: 12px;
		border-radius: 6px;
		font-size: 0.85rem;
		outline: none;
		background: white;
		width: 220px;
	}

	.minimal-select {
		border: 1px solid #e2e8f0;
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 0.85rem;
		outline: none;
		background: white;
	}

	.table-container {
		background: white;
		border-radius: 8px;
		border: 1px solid #e2e8f0;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
		overflow: hidden;
		overflow-x: auto;
	}

	.table-container::-webkit-scrollbar {
		height: 8px;
		background: #f1f5f9;
	}

	.table-container::-webkit-scrollbar-thumb {
		background: #cbd5f5;
		border-radius: 4px;
	}

	.table-container::-webkit-scrollbar-thumb:hover {
		background: #a5b4fc;
	}
	th:nth-child(1),
	th:nth-child(2),
	th:nth-child(3),
	th:nth-child(4),
	th:nth-child(5),
	th:nth-child(6),
	th:nth-child(7),
	td:nth-child(1),
	td:nth-child(2),
	td:nth-child(3),
	td:nth-child(4),
	td:nth-child(5),
	td:nth-child(6),
	td:nth-child(7) {
		min-width: 70px;
	} /* All columns same width except Quantity */

	th:nth-child(8),
	td:nth-child(8) {
		min-width: 85px;
		width: 85px;
	} /* Quantity column */
	table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed; /* Prevents wide content from stretching the table */
	}
	th {
		text-align: left;
		padding: 14px 20px;
		background: #f1f5f9;
		font-size: 0.7rem;
		color: #000000;
		text-transform: uppercase;
		border-bottom: 1px solid #e2e8f0;
		letter-spacing: 0.05em;
		font-weight: 700;
	}
	td {
		padding: 16px 20px;
		border-bottom: 1px solid #dddddd;
		font-size: 0.9rem;
		vertical-align: middle;
	}

	tr:hover td {
		background-color: #f8fafc;
	}

	/* Zebra striping and sticky header for better readability */
	thead th {
		position: sticky;
		top: 0;
		z-index: 2;
		background: #f1f5f9;
	}

	tbody tr:nth-child(odd) td {
		background: #ffffff;
	}

	tbody tr:nth-child(even) td {
		background: #fbfcfe;
	}

	/* Ensure cell text doesn't force expansion */
	th,
	td {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.p-name {
		font-weight: 600;
		color: #1e293b;
		word-break: break-word;
		word-wrap: break-word;
		white-space: normal;
		line-height: 1.3;
		max-width: 100%;
	}

	.text-dim {
		color: #64748b;
	}

	/* Color Dot Styles */
	.color-indicator {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: 1px solid #cbd5e1;
		display: inline-block;
	}

	.cost-text {
		color: #64748b;
		font-weight: 500;
	}
	.price-text {
		font-weight: 700;
		color: #059669;
	}

	/* Tooltip behavior check: Ensure SVG doesn't block clicks */
	svg {
		pointer-events: none;
	}
	th.sortable {
		cursor: pointer;
		position: relative;
		transition: background-color 0.2s ease;
	}

	/* Optional: Subtle animation for the sort arrow */
	th.sortable:hover::after {
		content: ' (Sort)';
		font-size: 0.6rem;
		position: absolute;
		bottom: -15px;
		left: 50%;
		transform: translateX(-50%);
		background: #1e293b;
		color: white;
		padding: 2px 6px;
		border-radius: 4px;
		white-space: nowrap;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.2s;
	}

	th.sortable:hover::after {
		opacity: 1;
	}
	/* MODAL */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10;
		backdrop-filter: blur(2px);
	}
	.modal-card {
		background: white;
		padding: 1.5rem;
		border-radius: 12px;
		width: 450px;
		max-width: 90vw;
		max-height: 85vh;
		overflow-y: auto;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}
	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 5rem 2rem;
		margin: 2rem auto;
		max-width: 600px;
		background: #ffffff;
		border: 2px dashed #e2e8f0; /* Dashed border suggests a "slot" to be filled */
		border-radius: 16px;
		text-align: center;
	}

	.empty-state h2 {
		color: #1e293b;
		font-size: 1.5rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
	}

	.empty-state p {
		color: #64748b;
		font-size: 1rem;
		max-width: 320px;
		margin-bottom: 2rem;
		line-height: 1.5;
	}
	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	/* Title */
	.modal-title {
		font-size: 18px;
		font-weight: 600;
		color: #111827;
		letter-spacing: 0.3px;
	}

	/* Close button */
	.btn-close {
		background: transparent;
		border: none;
		font-size: 18px;
		cursor: pointer;
		color: #6b7280;
		transition: 0.15s ease;
	}

	.btn-close:hover {
		color: #111827;
		transform: scale(1.1);
	}

	/* Barcode section */
	.barcode-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 12px 0;
	}

	.barcode-box svg {
		width: 100%;
		max-width: 260px;
		height: auto;
	}

	/* Barcode number */
	.barcode-number {
		margin-top: 10px;
		font-size: 14px;
		letter-spacing: 1.2px;
		color: #374151;
		font-family: monospace;
	}
	.btn-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: #64748b;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.barcode-btn {
		/* Reset default button styles */
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		font-family: inherit;
		font-size: 0.9rem;

		/* Aesthetic styling */
		color: #2563eb; /* A nice modern blue */
		cursor: pointer;
		font-weight: 500;
		transition: color 0.2s ease;
		text-decoration: underline dotted; /* Subtle hint that it's clickable */
	}

	.barcode-btn:hover {
		color: #1d4ed8;
		text-decoration: underline;
	}

	.barcode-btn:focus {
		outline: 2px solid #2563eb;
		outline-offset: 2px;
		border-radius: 2px;
	}


	.btn-close:hover {
		background: #e2e8f0;
		color: #1e293b;
	}
	th.sortable {
		cursor: pointer;
		padding: 12px;
		/* background: #f8fafc; */
		transition: all 0.2s;
	}

	.skeleton-row td {
		padding: 16px;
		border-bottom: 1px solid #f1f5f9;
	}

	.skeleton-bar {
		height: 12px;
		background: #e2e8f0;
		background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
		background-size: 200% 100%;
		animation: skeleton-shimmer 1.5s infinite linear;
		border-radius: 4px;
		width: 100%;
	}

	@keyframes skeleton-shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	/* Visual cue for the Stock column */

	.snackbar {
		position: fixed;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
		background: #1e293b;
		color: white;
		padding: 8px 16px;
		border-radius: 20px;
		font-size: 0.8rem;
		font-weight: 600;
	}
	/* ===== RESPONSIVE STYLES ===== */

	/* 14" 16:10 laptops (1920x1200 and similar) */
	@media (max-width: 1920px) and (max-height: 1200px) {
		.main-title {
			font-size: 1.6rem;
		}

		th,
		td {
			padding: 12px 16px;
			font-size: 0.9rem;
		}

		th {
			font-size: 0.75rem;
		}

		.summary-cards {
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		}

		.summary-value {
			font-size: 1.6rem;
		}
	}

	/* Smaller 14" 16:10 laptops (1680x1050, 1440x900) */
	@media (max-width: 1680px) {
		.main-title {
			font-size: 1.5rem;
		}

		.subtitle {
			font-size: 0.85rem;
		}

		th,
		td {
			padding: 10px 12px;
			font-size: 0.88rem;
		}

		th {
			font-size: 0.72rem;
			padding: 12px;
		}

		.minimal-input {
			width: 150px;
			font-size: 0.85rem;
		}

		.minimal-select {
			font-size: 0.85rem;
			padding: 8px 12px;
		}

		.modal-card {
			width: 400px;
		}

		.p-name {
			font-size: 0.9rem;
		}

		.text-dim {
			font-size: 0.85rem;
		}

		.summary-cards {
			grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
			gap: 12px;
		}

		.summary-value {
			font-size: 1.5rem;
		}

		.summary-card {
			padding: 16px;
		}
	}

	/* Very small 14" 16:10 (1440x900, 1280x800) */
	@media (max-width: 1440px) {
		.header-section {
			gap: 0.75rem;
		}

		.main-title {
			font-size: 1.4rem;
		}

		th,
		td {
			padding: 9px 11px;
			font-size: 0.85rem;
		}

		th {
			font-size: 0.68rem;
			padding: 10px;
		}

		.minimal-input {
			width: 140px;
			font-size: 0.82rem;
			padding: 7px 10px;
		}
		.modal-card {
			width: 380px;
			padding: 1.3rem;
		}

		.summary-cards {
			grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
			gap: 12px;
		}

		.summary-value {
			font-size: 1.3rem;
		}

		.summary-card {
			padding: 14px;
		}

		.summary-label {
			font-size: 0.8rem;
		}
	}

	/* Small laptops (1280px and below) */
	@media (max-width: 1280px) {
		.table-container {
			overflow-x: auto;
		}

		.header-section {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.75rem;
		}

		.header-controls {
			width: 100%;
			gap: 6px;
		}

		.minimal-input {
			width: 140px;
		}

		th,
		td {
			padding: 8px 10px;
		}

		.p-name {
			font-size: 0.85rem;
		}
	}

	@media (max-width: 1024px) {
		.header-section {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.header-controls {
			width: 100%;
			flex-wrap: wrap;
		}

		.minimal-input {
			width: 100%;
			flex: 1;
			min-width: 200px;
		}

		.minimal-select {
			flex: 1;
			min-width: 150px;
		}
		.modal-card {
			width: 90%;
			max-width: 450px;
		}

		.summary-cards {
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		}
	}

	@media (max-width: 768px) {
		.main-title {
			font-size: 1.25rem;
		}

		.minimal-select {
			width: auto;
		}

		.summary-card {
			padding: 16px;
		}

		.summary-value {
			font-size: 1.4rem;
		}

		/* Hide table headers on mobile and show card-style rows */
		table thead {
			display: none;
		}

		/* Convert table to card layout */
		table,
		tbody,
		tr {
			display: block;
			width: 100%;
		}

		tr {
			border: 1px solid #e2e8f0;
			border-radius: 8px;
			margin-bottom: 1rem;
			padding: 12px;
			background: white;
			box-shadow: 0 1px 4px rgba(2, 6, 23, 0.03);
		}

		td {
			display: flex;
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
			border: none;
			padding: 8px 0;
			border-bottom: 1px solid #f1f5f9;
			min-width: 0; /* allow shrink */
			gap: 12px;
		}

		/* td:last-child {
			border-bottom: none;
		} */

		td::before {
			content: attr(data-label);
			font-weight: 700;
			font-size: 0.72rem;
			color: #64748b;
			text-transform: none;
			letter-spacing: 0.02em;
			display: inline-block;
			flex: 0 0 110px; /* fixed label width */
			margin-right: 8px;
		}


		tr:hover td {
			background-color: transparent;
		}

		.modal-card {
			width: 95%;
			max-width: 100%;
			max-height: 90vh;
			overflow-y: auto;
			padding: 1rem;
		}
	}

	@media (max-width: 480px) {
		/* 1. Hide the real table headers */
		thead {
			display: none;
		}

		/* Hide brand on mobile */
		.p-sku {
			display: none;
		}

		/* 2. Turn each row into a standalone card */
		tr {
			display: block;
			background: #ffffff;
			border: 1px solid #e2e8f0;
			border-radius: 16px;
			padding: 1rem;
			margin-bottom: 1rem;
			box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
		}

		/* Reset Quantity column width for mobile */
		td:nth-child(8) {
			width: auto;
			min-width: 0;
		}

		/* 3. Layout each cell as a key-value row */
		td {
			display: flex;
			justify-content: space-between;
			align-items: flex-start; /* Better for multi-line content */
			border: none;
			padding: 10px 0;
			border-bottom: 1px solid #f1f5f9;
			font-size: 0.9rem;
		}

		/* Remove border from the last item in the card */
		td:last-child {
			border-bottom: none;
		}

		/* 4. The Label (Left Side) */
		td::before {
			content: attr(data-label);
			font-weight: 700;
			font-size: 0.75rem;
			color: #64748b;
			text-transform: uppercase;
			letter-spacing: 0.025em;
			flex: 0 0 120px; /* Fixed width for labels to keep values aligned */
			margin-right: 12px;
		}

		/* 5. The Value (Right Side) - word wrapping for all cells */
		td {
			text-align: left;
			word-break: break-word;
		}

		/* Ensure Product/Brand stack is correct */
		td:first-child {
			text-align: left;
		}
	}
</style>
