<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	$: currentPath = $page.url.pathname;
	import { getApiBaseUrl } from '$lib/utils/apiBase';
	let isSidebarCollapsed = false;
	let screenWidth = 0;

	onMount(() => {
		screenWidth = window.innerWidth;
		// Auto-collapse on load if screen is below 800px
		if (screenWidth < 800) {
			isSidebarCollapsed = true;
		}

		// Listen for window resize
		const handleResize = () => {
			screenWidth = window.innerWidth;
			if (screenWidth < 800) {
				isSidebarCollapsed = true;
			}
		};

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

	async function logout() {
		// This calls your logout API and redirects to login
		await fetch(getApiBaseUrl() + '/api/logout', { method: 'POST' });
		goto('/login');
	}
</script>

<div class="admin-layout" class:collapsed={isSidebarCollapsed}>
	<div
		class="sidebar-overlay"
		on:click={() => (isSidebarCollapsed = true)}
		aria-hidden="true"
	></div>

	<aside class="sidenav">
		<div class="sidebar-header">
			<div class="logo-container"><img src="/JJGAPO.png" alt="JJGAPO Logo" class="logo-img" /></div>
		</div>
		<nav>
			<a
				href="/super_admin/dashboard"
				class:active={currentPath.startsWith('/super_admin/dashboard')}
				data-tooltip="Dashboard"
			>
				<span class="nav-icon"
					><svg
						xmlns="http://www.w3.org/2000/svg"
						height="20px"
						viewBox="0 -960 960 960"
						width="20px"
						fill="#e3e3e3"
						><path
							d="M520-600v-240h320v240H520ZM120-440v-400h320v400H120Zm400 320v-400h320v400H520Zm-400 0v-240h320v240H120Zm80-400h160v-240H200v240Zm400 320h160v-240H600v240Zm0-480h160v-80H600v80ZM200-200h160v-80H200v80Zm160-320Zm240-160Zm0 240ZM360-280Z"
						/></svg
					></span
				> <span class="nav-text">Dashboard</span>
			</a>
			<a
				href="/super_admin/stocks"
				class:active={currentPath.startsWith('/super_admin/stocks')}
				data-tooltip="Stocks"
			>
				<span class="nav-icon"
					><svg height="20px" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" fill="#000000"
						><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g
							id="SVGRepo_tracerCarrier"
							stroke-linecap="round"
							stroke-linejoin="round"
						></g><g id="SVGRepo_iconCarrier">
							<g fill="none" fill-rule="evenodd">
								<path d="m0 0h32v32h-32z"></path>
								<path
									d="m16 0 13.8564065 8v16l-13.8564065 8-13.85640646-8v-16zm0 2.309-11.857 6.846v13.689l11.857 6.846 11.856-6.846v-13.689zm6.550845 8.3654304.9389431 1.7658952-6.5015238 3.4551048.0002619 7.7701392h-2l-.0002619-7.7691392-6.50100003-3.4561048.93894312-1.7658952 6.56205691 3.489z"
									fill="#ffffff"
									fill-rule="nonzero"
								></path>
							</g>
						</g></svg
					></span
				> <span class="nav-text">Stocks</span>
			</a>
		</nav>
		<div class="footer">
			<footer class="credits">
				<p>
					© 2026 <span class="dev-name" data-tooltip="📧 batidencee@gmail.com">
						<strong>Dencelle</strong>
					</span>
				</p>
			</footer>
			<button class="logout-btn" on:click={logout} data-tooltip="Logout">
				<span class="icon"
					><svg height="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
						><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g
							id="SVGRepo_tracerCarrier"
							stroke-linecap="round"
							stroke-linejoin="round"
						></g><g id="SVGRepo_iconCarrier">
							<g id="Interface / Log_Out">
								<path
									id="Vector"
									d="M12 15L15 12M15 12L12 9M15 12H4M9 7.24859V7.2002C9 6.08009 9 5.51962 9.21799 5.0918C9.40973 4.71547 9.71547 4.40973 10.0918 4.21799C10.5196 4 11.0801 4 12.2002 4H16.8002C17.9203 4 18.4796 4 18.9074 4.21799C19.2837 4.40973 19.5905 4.71547 19.7822 5.0918C20 5.5192 20 6.07899 20 7.19691V16.8036C20 17.9215 20 18.4805 19.7822 18.9079C19.5905 19.2842 19.2837 19.5905 18.9074 19.7822C18.48 20 17.921 20 16.8031 20H12.1969C11.079 20 10.5192 20 10.0918 19.7822C9.71547 19.5905 9.40973 19.2839 9.21799 18.9076C9 18.4798 9 17.9201 9 16.8V16.75"
									stroke="#ff0000"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								></path>
							</g>
						</g></svg
					></span
				> <span class="nav-text">Logout</span>
			</button>
		</div>
	</aside>
	<main class="content">
		<header class="content-header">
			<button
				class="sidebar-toggle"
				on:click={() => (isSidebarCollapsed = !isSidebarCollapsed)}
				aria-label={isSidebarCollapsed ? 'Open sidebar' : 'Close sidebar'}
				title={isSidebarCollapsed ? 'Open sidebar' : 'Close sidebar'}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path
						d="M4 7h16M4 12h16M4 17h16"
						fill="none"
						stroke="currentColor"
						stroke-width="2.25"
						stroke-linecap="round"
					/>
				</svg>
			</button>
		</header>
		<slot />
	</main>
</div>

<style>
	/* 1. CONFIG & BASE */
	:root {
		--nav-bg: #0f172a;
		--nav-surface: #111c2e;
		--nav-accent: #38bdf8;
		--nav-hover: #1e293b;
		--nav-hover-soft: rgba(56, 189, 248, 0.12);
		--text-muted: #94a3b8;
		--page-bg: #f8fafc;
		--page-surface: #ffffff;
		--page-border: #e2e8f0;
	}
	:global(html),
	:global(body) {
		margin: 0;
		padding: 0;
		overflow-x: hidden;
		background-color: var(--page-bg);
		color: #0f172a;
	}
	:global(aside) {
		margin: 0;
		padding: 0;
	}
	.admin-layout {
		--sidebar-width: 230px;
		display: flex;
		min-height: 100vh;
		background:
			radial-gradient(circle at top left, rgba(56, 189, 248, 0.08), transparent 35%),
			linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
		position: relative;
		margin: 0;
		padding: 0;
	}
	.admin-layout.collapsed {
		--sidebar-width: 60px;
	}
	.admin-layout.collapsed .logo-img {
		display: none;
	}
	.admin-layout.collapsed .sidebar-header {
		justify-content: center;
		padding-top: 10px;
	}

	.admin-layout.collapsed nav a {
		padding-left: 12px;
	}
	.admin-layout.collapsed .nav-icon {
		margin-right: 12px;
	}
	.admin-layout.collapsed .logout-btn {
		padding: 8px 12px;
		justify-content: center;
	}
	.admin-layout.collapsed .logout-btn .nav-text {
		opacity: 0;
		width: 0;
		overflow: hidden;
	}
	.admin-layout.collapsed .logout-btn .icon {
		margin-right: 0;
	}
	.sidebar-overlay {
		display: none;
		position: fixed;
		inset: 0;
		background: rgba(2, 6, 23, 0.62);
		backdrop-filter: blur(2px);
		z-index: 90;
	}
	.sidenav {
		width: var(--sidebar-width);
		background:
			linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(15, 23, 42, 0.92) 100%),
			radial-gradient(circle at top left, rgba(56, 189, 248, 0.16), transparent 45%);
		box-shadow: 0 24px 55px rgba(15, 23, 42, 0.3);
		color: white;
		display: flex;
		flex-direction: column;
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		z-index: 100;
		transition: width 0.3s ease;
		margin: 0;
		padding: 0;
	}
	.sidebar-header {
		padding: 20px 10px;
		display: flex;
		
		align-items: center;
		justify-content: center;
		margin-top: 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		gap: 8px;
		position: relative;
		flex-shrink: 0;
	}
	.sidebar-toggle {
		position: relative;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.22);
		background: rgba(15, 23, 42, 0.06);
		color: #0f172a;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition:
			transform 0.2s ease,
			color 0.2s ease,
			opacity 0.2s ease;
		z-index: 120;
		padding: 0;
	}
	.sidebar-toggle:hover {
		transform: translateY(-1px);
		background: rgba(15, 23, 42, 0.1);
	}
	.content-header {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		padding: 0 0 0.9rem 0;
		margin-bottom: 0.25rem;
	}
	.sidebar-toggle svg {
		width: 22px;
		height: 22px;
		display: block;
	}
	.logo-container {
		background: transparent;
		border-radius: 8px;
	}
	.logo-img {
		width: 140px;
		height: auto;
		display: block;
		margin: 0 auto;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
		object-fit: contain;
	}
	 /* 4. NAVIGATION */
	nav {
		flex: 1;
		padding: 8px 8px;
	}
	nav a {
		display: flex;
		align-items: center;
		padding: 8px 12px;
		margin-bottom: 2px;
		color: var(--text-muted);
		text-decoration: none;
		border-radius: 8px;
		font-size: 0.9rem;
		transition: all 0.2s;
	}
	.nav-icon {
		margin-right: 12px;
		flex-shrink: 0;
	}
	.nav-text {
		opacity: 1;
		transition: opacity 0.3s ease;
	}
	.admin-layout.collapsed .nav-text {
		opacity: 0;
		width: 0;
		overflow: hidden;
	}
	nav a:hover {
		background-color: var(--nav-hover-soft);
		color: white;
	}
	/* Ensure the active state is very visible */
	nav a.active {
		background-color: var(--nav-accent) !important;
		color: #0f172a !important;
		font-weight: 700 !important;
		opacity: 1 !important;
		border-radius: 8px;
	}
	/* Keep the icon bright when active */
	nav a.active .nav-icon svg {
		fill: #0f172a !important;
	}
	/* Prevent the hover effect from "flickering" the active state */
	nav a.active:hover {
		background-color: var(--nav-accent) !important;
		cursor: default;
	}
	.admin-layout.collapsed nav a.active {
		background-color: var(--nav-accent) !important;
		color: #0f172a !important;
		opacity: 1 !important;
	}
	/* Navigation & Button Tooltips */
	nav a,
	.logout-btn {
		position: relative;
	}
	nav a::after,
	.logout-btn::after {
		content: attr(data-tooltip);
		position: absolute;
		left: calc(100% + 12px);
		top: 50%;
		transform: translateY(-50%);
		background-color: #1f2937;
		color: white;
		padding: 6px 12px;
		border-radius: 6px;
		white-space: nowrap;
		font-size: 0.75rem;
		font-weight: 500;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
		opacity: 0;
		visibility: hidden;
		transition: opacity 0.2s ease;
		z-index: 1000;
		pointer-events: none;
	}
	nav a:hover::after,
	.logout-btn:hover::after {
		opacity: 1;
		visibility: visible;
	}
	/* Hide tooltips when sidebar is expanded and text is visible */
	.admin-layout:not(.collapsed) nav a::after,
	.admin-layout:not(.collapsed) .logout-btn::after {
		display: none;
	}
	/* 5. FOOTER */
	.footer {
		padding: 8px 8px;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
		flex-shrink: 0;
	}
	.logout-btn {
		width: 100%;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(148, 163, 184, 0.18);
		color: #f8fafc;
		padding: 8px;
		border-radius: 8px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		transition: 0.2s;
	}
	.logout-btn:hover {
		background: rgba(56, 189, 248, 0.14);
		color: white;
	}
	.credits {
		margin-top: 8px;
		padding: 6px;
		text-align: center;
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.dev-name {
		color: var(--nav-accent);
		font-weight: 700;
		cursor: pointer;
		position: relative;
	}

	.dev-name::after {
		content: attr(data-tooltip);
		position: absolute;
		bottom: 125%;
		left: 50%;
		transform: translateX(-50%);
		background-color: #0f172a;
		color: white;
		padding: 6px 10px;
		border-radius: 6px;
		white-space: nowrap;
		font-size: 0.65rem;
		font-weight: 400;
		box-shadow: 0 8px 20px rgba(15, 23, 42, 0.25);
		opacity: 0;
		visibility: hidden;
		transition: opacity 0.3s ease;
		z-index: 1000;
	}

	.dev-name:hover::after {
		opacity: 1;
		visibility: visible;
	}

	.dev-name:hover::before {
		content: '';
		position: absolute;
		bottom: 105%;
		left: 50%;
		transform: translateX(-50%);
		border-width: 5px;
		border-style: solid;
		border-color: #0f172a transparent transparent transparent;
		opacity: 1;
	}

	.credits strong {
		color: var(--nav-accent);
		font-weight: 600;
	}
	.content {
		flex: 1;
		margin-left: var(--sidebar-width);
		padding: 20px 20px 20px;
		width: 100%;
	}
	@media (max-width: 1024px) {
		.content {
			padding: 15px;
		}
	}
	@media (max-width: 768px) {
		.admin-layout {
			--sidebar-width: 0px;
		}
		.admin-layout:not(.collapsed) .sidebar-overlay {
			display: block;
		}
		.admin-layout:not(.collapsed) .sidebar-toggle {
			display: none;
		}
		.content {
			padding: 14px 12px 16px;
			margin-left: 0;
		}
		.sidenav {
			width: 280px;
			transform: translateX(-100%);
			transition: transform 0.28s ease;
			will-change: transform;
			border-right: 1px solid rgba(148, 163, 184, 0.15);
		}
		.admin-layout:not(.collapsed) .sidenav {
			transform: translateX(0);
		}
		.admin-layout.collapsed .sidenav {
			box-shadow: none;
		}
		.content-header {
			padding-bottom: 0.75rem;
		}
		.sidebar-header {
			flex-direction: row;
			align-items: center;
			justify-content: flex-start;
			padding-top: 10px;
			gap: 8px;
		}
		.logo-img,
	
		.nav-text {
			display: block;
		}
		.admin-layout.collapsed .logo-img,
	
		.admin-layout.collapsed .nav-text,
		.admin-layout.collapsed .credits {
			display: none;
		}
		.admin-layout.collapsed .nav-icon {
			margin-right: 0;
		}
		nav a {
			justify-content: flex-start;
			padding: 10px 14px;
		}
		nav a.active {
			background-color: var(--nav-accent) !important;
			color: #0f172a !important;
			font-weight: 700 !important;
		}
		.footer {
			padding: 12px 10px;
		}
		.logout-btn {
			width: 100%;
			padding: 10px 12px;
		}
	}
	@media (max-width: 480px) {
		.content {
			padding: 10px;
		}
		.sidenav {
			width: min(86vw, 300px);
		}
		.sidebar-toggle {
			width: 38px;
			height: 38px;
		}
	}
	.content-header {
		padding-bottom: 0.6rem;
	}
</style>
