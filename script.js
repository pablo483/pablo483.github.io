(function () {
  const root = document.documentElement;
  root.classList.add("js-ready");

  const themeBtn = document.getElementById("theme-toggle");
  const mobileBtn = document.getElementById("mobile-menu-btn");
  const navLinks = document.getElementById("nav-links");
  const yearSpan = document.getElementById("year");
  const toast = document.getElementById("toast");
  const scrollProgress = document.getElementById("scroll-progress");
  const backToTopBtn = document.getElementById("back-to-top");
  const typingEl = document.getElementById("typing-role");
  const terminalBody = document.getElementById("terminal-body");

  // 1. Dynamic copyright year
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // 2. Theme toggle (persisted in localStorage)
  const savedTheme = localStorage.getItem("portfolio_theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    root.setAttribute("data-theme", savedTheme);
  }

  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("portfolio_theme", next);
    });
  }

  // 3. Mobile navigation drawer
  if (mobileBtn && navLinks) {
    mobileBtn.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("open");
      mobileBtn.setAttribute("aria-expanded", String(isOpen));
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        mobileBtn.setAttribute("aria-expanded", "false");
      });
    });
  }

  // 4. Scroll progress bar & Back-to-Top visibility
  function handleScroll() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;

    if (scrollProgress) {
      scrollProgress.style.transform = `scaleX(${ratio})`;
    }

    if (backToTopBtn) {
      backToTopBtn.classList.toggle("visible", scrollTop > 420);
    }
  }

  window.addEventListener("scroll", handleScroll, { passive: true });
  handleScroll();

  if (backToTopBtn) {
    backToTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // 5. Staggered Scroll-Reveal (IntersectionObserver)
  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -30px 0px" }
    );
    revealItems.forEach((el) => revealObserver.observe(el));
  } else {
    revealItems.forEach((el) => el.classList.add("is-visible"));
  }

  // 6. Active Navigation Scroll-Spy
  const sections = document.querySelectorAll("main section[id]");
  const navItems = document.querySelectorAll(".nav-links a[data-nav]");
  if ("IntersectionObserver" in window && sections.length) {
    const spyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.getAttribute("id");
          navItems.forEach((link) => {
            link.classList.toggle("active", link.getAttribute("data-nav") === id);
          });
        });
      },
      { rootMargin: "-35% 0px -55% 0px" }
    );
    sections.forEach((sec) => spyObserver.observe(sec));
  }

  // 7. Cursor-Tracking Spotlight Glow on Cards
  document.querySelectorAll(".spotlight-card").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
      card.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
    });
  });

  // 8. Hero Typewriter Cycling Effect
  const phrases = [
    "Spring Boot REST APIs.",
    "multi-tenant SaaS backends.",
    "Redis caching & rate limiters.",
    "event-driven Kafka pipelines."
  ];
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (typingEl && !prefersReducedMotion) {
    let phraseIndex = 0;
    let charIndex = phrases[0].length;
    let isDeleting = true;

    function tickTypewriter() {
      const current = phrases[phraseIndex];
      if (isDeleting) {
        charIndex--;
        typingEl.textContent = current.slice(0, charIndex);
        if (charIndex === 0) {
          isDeleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
          setTimeout(tickTypewriter, 260);
          return;
        }
        setTimeout(tickTypewriter, 32);
      } else {
        charIndex++;
        typingEl.textContent = current.slice(0, charIndex);
        if (charIndex === current.length) {
          isDeleting = true;
          setTimeout(tickTypewriter, 2200);
          return;
        }
        setTimeout(tickTypewriter, 58);
      }
    }

    setTimeout(tickTypewriter, 2200);
  }

  // 9. Interactive Hero Backend Pipeline Inspector
  const TRACES = {
    saas: [
      { type: "cmd", text: 'curl -H "X-Tenant-ID: org_nepal" /api/inventory' },
      { badge: "badge-ok", label: "FILTER", text: "TenantInterceptor -> isolated context" },
      { badge: "badge-ok", label: "LIMIT", text: "Bucket4j token bucket -> allowed" },
      { badge: "badge-cache", label: "CACHE", text: "Redis Jedis pool -> HIT" },
      { badge: "badge-http", label: "200 OK", text: "Nginx upstream (app1/app2/app3)" }
    ],
    kafka: [
      { type: "cmd", text: 'curl "/api/weather?city=Kathmandu"' },
      { badge: "badge-ok", label: "CLIENT", text: "WebFlux WebClient -> OpenWeather API" },
      { badge: "badge-cache", label: "CACHE", text: "Redis @Cacheable TTL -> stored (10m)" },
      { badge: "badge-ok", label: "KAFKA", text: "AuditEvent published -> manual_immediate ACK" },
      { badge: "badge-http", label: "200 OK", text: "Isolated async side-effect complete" }
    ],
    auth: [
      { type: "cmd", text: "curl -X POST /auth/refresh-token --cookie refreshToken=..." },
      { badge: "badge-ok", label: "COOKIE", text: "HttpOnly SameSite=Lax token extracted" },
      { badge: "badge-cache", label: "ROTATE", text: "Old DB token revoked -> new token issued" },
      { badge: "badge-ok", label: "SECURITY", text: "Replay protection verified in MySQL" },
      { badge: "badge-http", label: "200 OK", text: "Set-Cookie: accessToken (15m expiry)" }
    ]
  };

  function renderTrace(key) {
    if (!terminalBody || !TRACES[key]) return;
    terminalBody.innerHTML = "";
    TRACES[key].forEach((row) => {
      const div = document.createElement("div");
      if (row.type === "cmd") {
        div.className = "term-line cmd";
        const prompt = document.createElement("span");
        prompt.className = "prompt";
        prompt.textContent = "$";
        div.appendChild(prompt);
        div.appendChild(document.createTextNode(" " + row.text));
      } else {
        div.className = "term-line step";
        const badge = document.createElement("span");
        badge.className = row.badge;
        badge.textContent = row.label;
        div.appendChild(badge);
        div.appendChild(document.createTextNode(" " + row.text));
      }
      terminalBody.appendChild(div);
    });
  }

  document.querySelectorAll(".term-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".term-tab").forEach((t) => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      renderTrace(tab.getAttribute("data-trace"));
    });
  });

  // 10. Project category filtering with pop animation
  const filterBtns = document.querySelectorAll(".filter-btn");
  const projectCards = document.querySelectorAll(".project-card");

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const filter = btn.getAttribute("data-filter");

      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      projectCards.forEach((card) => {
        const tags = (card.getAttribute("data-tags") || "").split(/\s+/);
        const matches = filter === "all" || tags.includes(filter);
        card.hidden = !matches;
        if (matches) {
          card.classList.remove("filter-animate");
          void card.offsetWidth; // trigger reflow for smooth animation replay
          card.classList.add("filter-animate");
        }
      });
    });
  });

  // 11. One-click copy email button
  let toastTimer = null;
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 2400);
  }

  document.querySelectorAll(".copy-email-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const email = btn.getAttribute("data-email");
      if (!email) return;
      try {
        await navigator.clipboard.writeText(email);
        showToast("Copied: " + email);
      } catch {
        window.location.href = "mailto:" + email;
      }
    });
  });
})();
