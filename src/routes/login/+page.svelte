<script lang="ts">
	import { enhance } from '$app/forms';
	import { fade, fly } from 'svelte/transition';

	let isLoading = false;
	let showPassword = false;
	let rememberMe = false;
	export let form;
	$: errorMessage = form?.error;

	let lockoutSeconds = 0;
	let lockoutInterval: ReturnType<typeof setInterval> | null = null;
	let lastHandledForm: any = null;
	

	$: if (form?.locked && form !== lastHandledForm) {
		lastHandledForm = form;
		startLockoutCountdown(form.retryAfterSeconds ?? 900);
	}

	function startLockoutCountdown(seconds: number) {
		lockoutSeconds = seconds;
		if (lockoutInterval) clearInterval(lockoutInterval);
		lockoutInterval = setInterval(() => {
			lockoutSeconds -= 1;
			if (lockoutSeconds <= 0) {
				lockoutSeconds = 0;
				if (lockoutInterval) clearInterval(lockoutInterval);
			}
		}, 1000);
	}

		function formatCountdown(sec: number): string {
		const m = Math.floor(sec / 60);
		const s = sec % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function togglePassword() {
		showPassword = !showPassword;
	}

	// Password strength validator
	function validatePassword(pwd: string): { strength: number; feedback: string[] } {
		let strength = 0;
		const feedback = [];

		if (pwd.length >= 8) strength++;
		else feedback.push('At least 8 characters');

		if (/[a-z]/.test(pwd)) strength++;
		else feedback.push('One lowercase letter');

		if (/[A-Z]/.test(pwd)) strength++;
		else feedback.push('One uppercase letter');

		if (/\d/.test(pwd)) strength++;
		else feedback.push('One number');

		if (/[!@#$%^&*]/.test(pwd)) strength++;
		else feedback.push('One symbol (!@#$%^&*)');

		return { strength, feedback };
	}

	function onPasswordInput(e: any) {
		const pwd = e.target.value;
		validatePassword(pwd);
	}
</script>

<div class="login-page">
	<div class="login-card" in:fly={{ y: 30, duration: 800 }}>
		<div class="logo-section">
			<img src="/JJGAPO.png" alt="JJGAPO Logo" class="brand-mark" />
			<p>Secure Inventory Portal</p>
		</div>

		<form
			method="POST"
			use:enhance={() => {
				isLoading = true;
				return async ({ update }) => {
					// CSRF logic removed: backend no longer requires CSRF tokens
					isLoading = false;
					await update();
				};
			}}
		>
			<div class="input-group">
				<label for="username">Username</label>
				<div class="input-wrapper">
					<input
						id="username"
						name="username"
						type="text"
						placeholder="Admin ID or Username"
						required
						disabled={isLoading || lockoutSeconds > 0}
						autocomplete="username"
					/>
				</div>
			</div>
			<div class="input-group">
				<div class="label-row">
					<label for="password">Password</label>
				</div>
				<div class="input-wrapper password-wrapper">
					<input
						id="password"
						name="password"
						type={showPassword ? 'text' : 'password'}
						placeholder="••••••••"
						required
						disabled={isLoading || lockoutSeconds > 0}
						autocomplete="current-password"
						on:input={onPasswordInput}
						minlength="8"
					/>
					<button
						type="button"
						class="eye-btn"
						on:click={togglePassword}
						aria-label={showPassword ? 'Hide password' : 'Show password'}
						tabindex="-1"
					>
						{#if showPassword}
							<!-- Eye open SVG -->
							<svg
								viewBox="0 0 24 24"
								width="20"
								height="20"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
								<circle cx="12" cy="12" r="3" />
							</svg>
						{:else}
							<!-- Eye closed SVG -->
							<svg
								viewBox="0 0 24 24"
								width="20"
								height="20"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path
									d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.81 21.81 0 0 1 5.06-6.06M1 1l22 22"
								/>
								<path d="M9.53 9.53A3 3 0 0 0 12 15a3 3 0 0 0 2.47-5.47" />
							</svg>
						{/if}
					</button>
				</div>
			</div>
				<div class="remember-row">
					<label class="checkbox-label">
						<input type="checkbox" name="rememberMe" bind:checked={rememberMe} disabled={isLoading || lockoutSeconds > 0} />
						Remember me for 30 days
					</label>
			</div>
			<button
				type="submit"
				class:loading={isLoading}
				disabled={isLoading || lockoutSeconds > 0}
				aria-busy={isLoading}
			>
				{#if isLoading}
					<div class="spinner"></div>
				{:else if lockoutSeconds > 0}
					Locked — {formatCountdown(lockoutSeconds)}
				{:else}
					Sign In to Dashboard
				{/if}
			</button>

			{#if errorMessage}
				<div class="error-box" transition:fade role="alert">
					{errorMessage}
				</div>
			{/if}
		</form>

		<div class="login-footer">
			<p>© 2025 JJGapo MotoStock. All rights reserved.</p>
		</div>
	</div>
</div>

<style>
	/* Theme Variables aligned with Landing Page */
	:root {
		--brand-primary: #4f46e5;
		--brand-hover: #4338ca;
		--brand-dark: #0f172a;
		--text-slate: #64748b;
		--glass-bg: rgba(255, 255, 255, 0.95);
	}

	.login-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		/* Matches the clean, light background of the landing page */
		background-color: #f8fafc;
		background-image:
			radial-gradient(at 0% 0%, rgba(79, 70, 229, 0.05) 0px, transparent 50%),
			radial-gradient(at 100% 100%, rgba(147, 51, 234, 0.05) 0px, transparent 50%);
		font-family: 'Plus Jakarta Sans', sans-serif;
		padding: 24px;
	}

	.login-card {
		width: 100%;
		max-width: 400px;
		background: white;
		padding: 48px 40px;
		border-radius: 24px;
		/* Subtle elevation instead of heavy dark shadows */
		box-shadow:
			0 10px 25px -5px rgba(0, 0, 0, 0.02),
			0 20px 48px -12px rgba(0, 0, 0, 0.05);
		border: 1px solid #f1f5f9;
	}

	/* Logo Styling */
	.logo-section {
		text-align: center;
		margin-bottom: 40px;
	}

	.brand-mark {
		width: 230px;
		height: auto;
		margin: 0 auto 24px;
		display: block;
		border-radius: 16px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
		background: none;
		object-fit: contain;
		transition: width 0.2s;
	}

	.logo-section p {
		color: var(--text-slate);
		font-size: 0.875rem;
		margin-top: 4px;
	}

	/* Inputs */
	.input-group {
		margin-bottom: 24px;
	}
	.input-wrapper {
		display: flex;
		align-items: center;
	}

	.label-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	label {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--brand-dark);
	}

	input {
		width: 100%;
		padding: 12px 16px;
		background: #fcfdfe;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		font-size: 0.95rem;
		transition: all 0.2s;
		box-sizing: border-box;
	}

	input:focus {
		outline: none;
		border-color: var(--brand-primary);
		background: white;
		box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1);
	}

	/* Sign In Button */
	button {
		width: 100%;
		padding: 14px;
		background: var(--brand-dark);
		color: white;
		border: none;
		border-radius: 12px;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		justify-content: center;
		align-items: center;
		margin-top: 8px;
	}

	button:hover {
		background: var(--brand-primary);
		transform: translateY(-1px);
	}

	button:active {
		transform: translateY(0);
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.spinner {
		width: 18px;
		height: 18px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-box {
		margin-top: 16px;
		padding: 12px;
		background: #fef2f2;
		border: 1px solid #fee2e2;
		border-radius: 10px;
		color: #b91c1c;
		font-size: 0.8rem;
		text-align: center;
	}

	.login-footer {
		margin-top: 32px;
		text-align: center;
		font-size: 0.75rem;
		color: var(--text-slate);
	}
     .password-wrapper {
        position: relative;
        display: flex;
        align-items: center;
    }
    .password-wrapper input {
        width: 100%;
        padding-right: 2.5rem;
    }
	.password-wrapper .eye-btn {
		position: absolute;
		right: 0.75rem;
		top: 30%;
		transform: translateY(-50%);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #b0b6be;
		outline: none;
		box-shadow: none;
		width: 32px;
		height: 32px;
		z-index: 2;
	}
	.eye-btn {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		color: #b0b6be;
		transition: color 0.2s;
	}
    .password-wrapper .eye-btn:focus {
        outline: none;
        box-shadow: none;
    }
    .password-wrapper .eye-btn:hover {
        color: var(--brand-primary);
        background: none;
    }
	.password-wrapper .eye-btn svg {
		width: 20px;
		height: 20px;
		stroke: currentColor;
		stroke-width: 2;
		fill: none;
		pointer-events: none;
	}
		.remember-row {
		display: flex;
		align-items: center;
		margin-bottom: 20px;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.85rem;
		color: var(--text-slate);
		cursor: pointer;
		font-weight: 400;
	}

	.checkbox-label input[type='checkbox'] {
		width: 16px;
		height: 16px;
		accent-color: var(--brand-primary);
		cursor: pointer;
	}

</style>
