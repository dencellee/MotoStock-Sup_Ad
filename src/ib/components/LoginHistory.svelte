<script lang="ts">
	import { onMount } from 'svelte';

	interface LoginRecord {
		id: number;
		username: string;
		ipAddress: string;
		browserInfo: string;
		loginTimeFormatted: string;
		status: string;
	}

	let logins: LoginRecord[] = [];
	let loading = true;
	let error: string | null = null;

	onMount(async () => {
		try {
			const response = await fetch('/api/admin/login-history');
			if (!response.ok) {
				throw new Error(`Failed to fetch: ${response.statusText}`);
			}
			const data = await response.json();
			logins = data.logins || [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load login history';
			console.error('Login history error:', err);
		} finally {
			loading = false;
		}
	});
</script>

<div class="login-history-panel">
	<div class="panel-header">
		<h3>🔐 Admin Login History</h3>
		<span class="login-count">{logins.length} recent logins</span>
	</div>

	{#if loading}
		<div class="loading">Loading login history...</div>
	{:else if error}
		<div class="error">⚠️ {error}</div>
	{:else if logins.length === 0}
		<div class="empty">No login activity recorded</div>
	{:else}
		<div class="login-table-wrapper">
			<table class="login-table">
				<thead>
					<tr>
						<th>Time</th>
						<th>Username</th>
						<th>IP Address</th>
						<th>Browser</th>
					</tr>
				</thead>
				<tbody>
					{#each logins as login (login.id)}
						<tr>
							<td class="time">{login.loginTimeFormatted}</td>
							<td class="username">{login.username}</td>
							<td class="ip">{login.ipAddress}</td>
							<td class="browser">{login.browserInfo}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.login-history-panel {
		background: white;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
		margin-top: 2rem;
		overflow: hidden;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
		color: white;
		border-bottom: 2px solid #38bdf8;
	}

	.panel-header h3 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
	}

	.login-count {
		background: rgba(56, 189, 248, 0.2);
		padding: 0.25rem 0.75rem;
		border-radius: 20px;
		font-size: 0.85rem;
		color: #38bdf8;
		font-weight: 500;
	}

	.loading,
	.error,
	.empty {
		padding: 2rem;
		text-align: center;
		color: #64748b;
		font-size: 0.95rem;
	}

	.error {
		background: #fef2f2;
		color: #991b1b;
	}

	.login-table-wrapper {
		overflow-x: auto;
	}

	.login-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.login-table thead {
		background: #f1f5f9;
		border-bottom: 2px solid #cbd5e1;
	}

	.login-table th {
		padding: 1rem;
		text-align: left;
		font-weight: 600;
		color: #1e293b;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.login-table tbody tr {
		border-bottom: 1px solid #e2e8f0;
		transition: background 0.2s;
	}

	.login-table tbody tr:hover {
		background: #f8fafc;
	}

	.login-table tbody tr:nth-child(even) {
		background: #f8fafc;
	}

	.login-table td {
		padding: 1rem;
		color: #334155;
	}

	.login-table .time {
		font-weight: 500;
		color: #0f172a;
		font-family: 'Monaco', 'Courier New', monospace;
		font-size: 0.85rem;
	}

	.login-table .username {
		color: #38bdf8;
		font-weight: 600;
	}

	.login-table .ip {
		font-family: 'Monaco', 'Courier New', monospace;
		font-size: 0.85rem;
		color: #64748b;
	}

	.login-table .browser {
		color: #475569;
	}

	@media (max-width: 768px) {
		.panel-header {
			flex-direction: column;
			gap: 0.75rem;
			text-align: center;
		}

		.login-table {
			font-size: 0.8rem;
		}

		.login-table th,
		.login-table td {
			padding: 0.75rem 0.5rem;
		}

		.login-table .time {
			max-width: 120px;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}
</style>
