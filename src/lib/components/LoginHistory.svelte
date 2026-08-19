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

<div class="login-history-card">
	<div class="card-header">
		<div>
			<h4>🔐 Login History</h4>
			<p class="subtitle">Recent super admin access</p>
		</div>
		<span class="badge">{logins.length}</span>
	</div>

	{#if loading}
		<div class="state-message">Loading login history...</div>
	{:else if error}
		<div class="state-message error">⚠️ {error}</div>
	{:else if logins.length === 0}
		<div class="state-message">No login activity recorded</div>
	{:else}
		<div class="table-wrapper">
			<table>
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
	.login-history-card {
		background: white;
		border-radius: 24px;
		border: 1px solid #e2e8f0;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
		padding: 1.75rem;
		margin-top: 2.5rem;
		overflow: hidden;
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.5rem;
		gap: 1rem;
	}

	.card-header h4 {
		margin: 0 0 0.25rem 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #0f172a;
	}

	.subtitle {
		margin: 0;
		font-size: 0.875rem;
		color: #64748b;
		font-weight: 400;
	}

	.badge {
		background: #eff6ff;
		color: #0369a1;
		padding: 0.375rem 0.75rem;
		border-radius: 12px;
		font-size: 0.875rem;
		font-weight: 600;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.state-message {
		padding: 2rem;
		text-align: center;
		color: #64748b;
		font-size: 0.95rem;
	}

	.state-message.error {
		background: #fef2f2;
		color: #991b1b;
		border-radius: 12px;
	}

	.table-wrapper {
		overflow-x: auto;
		overflow-y: auto;
		max-height: 400px;
		border-top: 1px solid #e2e8f0;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	thead {
		position: sticky;
		top: 0;
		background: #f8fafc;
		border-bottom: 1px solid #e2e8f0;
	}

	th {
		padding: 0.875rem 1rem;
		text-align: left;
		font-weight: 600;
		color: #64748b;
		font-size: 0.8125rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	tbody tr {
		border-bottom: 1px solid #f1f5f9;
		transition: background-color 0.15s;
	}

	tbody tr:hover {
		background: #f8fafc;
	}

	td {
		padding: 0.875rem 1rem;
		color: #334155;
	}

	.time {
		font-weight: 500;
		color: #0f172a;
		font-size: 0.8125rem;
		white-space: nowrap;
	}

	.username {
		color: #2563eb;
		font-weight: 600;
	}

	.ip {
		font-family: 'Monaco', 'Courier New', monospace;
		font-size: 0.8125rem;
		color: #64748b;
	}

	.browser {
		color: #475569;
		font-size: 0.875rem;
	}

	@media (max-width: 768px) {
		.login-history-card {
			padding: 1.25rem;
			border-radius: 16px;
		}

		.card-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.table-wrapper {
			max-height: 300px;
		}

		th,
		td {
			padding: 0.625rem 0.75rem;
		}

		th {
			font-size: 0.75rem;
		}

		td {
			font-size: 0.8125rem;
		}
	}
</style>
