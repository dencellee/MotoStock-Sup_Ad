<nav class="navbar">
    <div class="nav-brand">
        <span class="logo-icon">🏍️</span>
        JJGapo <span class="highlight">MotoStock</span>
    </div>

    <div class="nav-links">
        <button class="login-btn" on:click={() => window.location.href = "/login"}>
            Access Dashboard
        </button>
    </div>
</nav>

<main class="landing-content">
    <section class="hero-section">
        <div class="hero-text">
            <span class="badge">Version 2.0 Live</span>
            <h1>The Precision Edge for <span class="gradient-text">Motorcycle Inventory.</span></h1>
            <p>
                From engines to exhaust pipes, track every SKU with surgical precision. 
                Built for heavy-duty warehouse management and real-time stock flow.
            </p>
            
            <div class="cta-group">
                <button class="primary-cta" on:click={() => window.location.href = "/login"}>
                    Get Started Now
                </button>
                <button class="secondary-cta">View Features</button>
            </div>
        </div>

        <div class="hero-visual">
            <div class="dashboard-preview">
                <div class="mock-chart"></div>
                <div class="mock-stats">
                    <div class="m-stat"></div>
                    <div class="m-stat"></div>
                </div>
            </div>
        </div>
    </section>

    <section class="features-grid">
        <div class="feature-card">
            <div class="icon-box blue">⚡</div>
            <h3>Instant Tracking</h3>
            <p>Real-time updates on every item arrival and departure.</p>
        </div>
        <div class="feature-card">
            <div class="icon-box purple">📊</div>
            <h3>Smart Analytics</h3>
            <p>Predict low stock patterns before they happen.</p>
        </div>
        <div class="feature-card">
            <div class="icon-box green">🛡️</div>
            <h3>Role Security</h3>
            <p>Strict access controls for warehouse staff and admins.</p>
        </div>
    </section>
</main>

<style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap');

    :global(body) {
        margin: 0;
        font-family: 'Plus Jakarta Sans', sans-serif;
        background-color: #ffffff;
        color: #1e293b;
    }

    /* NAVBAR */
    .navbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 8%;
        background: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(10px);
        position: sticky;
        top: 0;
        z-index: 1000;
        border-bottom: 1px solid #f1f5f9;
    }

    .nav-brand {
        font-size: 1.5rem;
        font-weight: 800;
        display: flex;
        align-items: center;
        gap: 10px;
        color: #0f172a;
    }

    .highlight { color: #4f46e5; }

    .login-btn {
        background: #0f172a;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: 0.3s;
    }

    .login-btn:hover { background: #4f46e5; transform: translateY(-2px); }

    /* HERO SECTION */
    .hero-section {
        padding: 80px 8% 40px;
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: 60px;
        align-items: center;
        max-width: 1400px;
        margin: 0 auto;
    }

    .badge {
        background: #eef2ff;
        color: #4f46e5;
        padding: 6px 14px;
        border-radius: 100px;
        font-size: 0.85rem;
        font-weight: 700;
        letter-spacing: 0.5px;
    }

    h1 {
        font-size: 4rem;
        line-height: 1.1;
        margin: 24px 0;
        color: #0f172a;
    }

    .gradient-text {
        background: linear-gradient(90deg, #4f46e5, #9333ea);
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    p {
        font-size: 1.25rem;
        color: #64748b;
        line-height: 1.6;
        margin-bottom: 40px;
    }

    /* BUTTONS */
    .cta-group { display: flex; gap: 16px; }

    .primary-cta {
        background: #4f46e5;
        color: white;
        border: none;
        padding: 16px 32px;
        border-radius: 14px;
        font-size: 1.1rem;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 10px 20px rgba(79, 70, 229, 0.2);
    }

    .secondary-cta {
        background: white;
        border: 1px solid #e2e8f0;
        padding: 16px 32px;
        border-radius: 14px;
        font-size: 1.1rem;
        font-weight: 600;
        cursor: pointer;
    }

    /* HERO VISUAL (DASHBOARD MOCKUP) */
    .hero-visual {
        background: #f8fafc;
        border-radius: 30px;
        padding: 30px;
        border: 1px solid #e2e8f0;
        box-shadow: 20px 20px 60px rgba(0,0,0,0.05);
    }

    .dashboard-preview {
        background: white;
        height: 350px;
        border-radius: 15px;
        border: 1px solid #e2e8f0;
        display: flex;
        flex-direction: column;
        padding: 20px;
        gap: 20px;
    }

    .mock-chart { flex: 1; background: #f1f5f9; border-radius: 10px; }
    .mock-stats { display: flex; gap: 10px; height: 80px; }
    .m-stat { flex: 1; background: #f8fafc; border-radius: 10px; }

    /* FEATURES */
    .features-grid {
        padding: 80px 8%;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 30px;
        max-width: 1400px;
        margin: 0 auto;
    }

    .feature-card {
        padding: 40px;
        border-radius: 24px;
        background: white;
        border: 1px solid #f1f5f9;
        transition: 0.3s;
    }

    .feature-card:hover { border-color: #4f46e5; transform: translateY(-5px); }

    .icon-box {
        width: 50px;
        height: 50px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        margin-bottom: 20px;
    }

    .blue { background: #e0f2fe; }
    .purple { background: #f5f3ff; }
    .green { background: #dcfce7; }

    @media (max-width: 1024px) {
        .hero-section { grid-template-columns: 1fr; text-align: center; }
        .cta-group { justify-content: center; }
        h1 { font-size: 3rem; }
    }
</style>