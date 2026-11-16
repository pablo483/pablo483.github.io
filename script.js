(function () {
  const root = document.documentElement;
  root.classList.add("js-ready");

  const themeBtn = document.getElementById("theme-toggle");
  const themeIcon = document.getElementById("theme-icon");
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

  // 2. Theme toggle (persisted in localStorage + animated View Transition circular reveal)
  let iconSpinTimer = null;
  let activeViewTransition = null;
  let particleEngine = null;

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("portfolio_theme", theme);
    } catch {
      // Ignore storage errors in restricted contexts
    }
    if (themeBtn) {
      themeBtn.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      );
    }
    if (particleEngine) {
      particleEngine.syncTheme(theme, true);
    }
  }

  let initialTheme = root.getAttribute("data-theme") === "light" ? "light" : "dark";
  try {
    const savedTheme = localStorage.getItem("portfolio_theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      initialTheme = savedTheme;
    }
  } catch {
    // Ignore storage errors
  }
  applyTheme(initialTheme);

  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const isDark = root.getAttribute("data-theme") === "dark";
      const nextTheme = isDark ? "light" : "dark";

      // Icon spin: toggle CSS class directly on the DOM node
      if (themeIcon) {
        themeIcon.classList.remove("theme-icon-spin");
        void themeIcon.offsetWidth;
        themeIcon.classList.add("theme-icon-spin");
        clearTimeout(iconSpinTimer);
        iconSpinTimer = setTimeout(() => {
          themeIcon.classList.remove("theme-icon-spin");
        }, 480);
      }

      // Fallback for browsers without View Transitions or reduced motion preference
      if (
        !document.startViewTransition ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        applyTheme(nextTheme);
        return;
      }

      const rect = themeBtn.getBoundingClientRect();
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const vt = document.startViewTransition(() => {
        root.classList.add("theme-transitioning");
        applyTheme(nextTheme);
      });

      activeViewTransition = vt;

      vt.ready
        .then(() => {
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`
              ]
            },
            {
              duration: 600,
              easing: "cubic-bezier(0.45, 0, 0.55, 1)",
              pseudoElement: "::view-transition-new(root)"
            }
          );
        })
        .catch(() => { });

      vt.finished
        .finally(() => {
          if (activeViewTransition === vt) {
            root.classList.remove("theme-transitioning");
            activeViewTransition = null;
          }
        });
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

  // 7. Cursor-Tracking Spotlight + Chad Bercea 3D CardTilt & Multi-Layer Depth Parallax
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  class InteractiveBoxTilt {
    constructor(card) {
      this.card = card;
      const isHeroTerminal = card.classList.contains("terminal-card");
      const isFeatured = card.classList.contains("featured") || card.classList.contains("contact-box");

      this.maxRotation = isHeroTerminal ? 12 : isFeatured ? 10 : 16;
      this.perspective = 750;
      this.scale = isHeroTerminal ? 1.02 : 1.035;

      this.children = Array.from(card.children);
      this.ctaLink = card.querySelector(".project-link, .btn-primary");

      this.isHovering = false;
      this.currentRot = { x: 0, y: 0 };
      this.targetRot = { x: 0, y: 0 };
      this.currentMag = { x: 0, y: 0 };
      this.targetMag = { x: 0, y: 0 };
      this.mousePos = { x: 0, y: 0 };
      this.rafId = null;

      this.init();
    }

    init() {
      // As soon as reveal finishes (or on first hover), clear --delay and CSS transform transition
      // so 3D tilt works identically on the 1st, 2nd, 3rd, 4th, and 5th cards in every section
      this.card.addEventListener("transitionend", (e) => {
        if (e.target === this.card && this.card.classList.contains("is-visible")) {
          this.card.classList.add("tilt-ready");
          this.card.style.removeProperty("--delay");
        }
      });
      this.card.addEventListener("mouseenter", () => this.onEnter());
      this.card.addEventListener("mouseleave", () => this.onLeave());
      this.card.addEventListener("mousemove", (e) => this.onMove(e));
    }

    onEnter() {
      if (prefersReducedMotion) return;
      this.card.classList.add("is-visible", "tilt-ready");
      this.card.style.removeProperty("--delay");
      this.isHovering = true;
      this.card.style.zIndex = "10";
      if (!this.rafId) {
        this.animate();
      }
    }

    onLeave() {
      this.isHovering = false;
      this.targetRot = { x: 0, y: 0 };
      this.targetMag = { x: 0, y: 0 };
      this.card.style.zIndex = "";
      this.card.style.setProperty("--shine-opacity", "0");
    }

    onMove(e) {
      const rect = this.card.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;
      this.card.style.setProperty("--mouse-x", `${relX}px`);
      this.card.style.setProperty("--mouse-y", `${relY}px`);

      if (prefersReducedMotion || !this.isHovering) return;

      this.mousePos = { x: e.clientX, y: e.clientY };
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const offsetX = (e.clientX - centerX) / (rect.width / 2);
      const offsetY = (e.clientY - centerY) / (rect.height / 2);

      // Tilt card toward mouse cursor (Chad Bercea CardTilt math)
      this.targetRot = {
        x: -offsetY * this.maxRotation,
        y: offsetX * this.maxRotation
      };
    }

    animate() {
      const ease = 0.14;
      this.currentRot.x += (this.targetRot.x - this.currentRot.x) * ease;
      this.currentRot.y += (this.targetRot.y - this.currentRot.y) * ease;

      const scale = this.isHovering ? this.scale : 1;
      this.card.style.transform = `perspective(${this.perspective}px) rotateX(${this.currentRot.x.toFixed(2)}deg) rotateY(${this.currentRot.y.toFixed(2)}deg) scale(${scale})`;

      // Specular shine position based on rotation
      const shineX = 50 + this.currentRot.y * 2.8;
      const shineY = 50 - this.currentRot.x * 2.8;
      this.card.style.setProperty("--shine-x", `${shineX}%`);
      this.card.style.setProperty("--shine-y", `${shineY}%`);
      this.card.style.setProperty("--shine-opacity", this.isHovering ? "1" : "0");

      // Multi-layer depth parallax on inner children
      const factorX = this.currentRot.y / this.maxRotation;
      const factorY = -this.currentRot.x / this.maxRotation;
      this.children.forEach((child, idx) => {
        const depth = 8 + (idx % 3) * 5;
        const moveX = factorX * depth;
        const moveY = factorY * depth;
        child.style.transform = `translate3d(${moveX.toFixed(1)}px, ${moveY.toFixed(1)}px, ${depth}px)`;
      });

      const stillMoving =
        Math.abs(this.targetRot.x - this.currentRot.x) > 0.02 ||
        Math.abs(this.targetRot.y - this.currentRot.y) > 0.02;

      if (this.isHovering || stillMoving) {
        this.rafId = requestAnimationFrame(() => this.animate());
      } else {
        this.rafId = null;
        this.card.style.transform = "";
        this.children.forEach((child) => {
          child.style.transform = "";
        });
      }
    }
  }

  document.querySelectorAll(".spotlight-card").forEach((card) => {
    new InteractiveBoxTilt(card);
  });

  // Make each entire .project-card clickable to open its main GitHub repository link
  document.querySelectorAll(".project-card").forEach((card) => {
    const primaryLink = card.querySelector(".project-title a, .project-link");
    if (!primaryLink) return;
    card.setAttribute("role", "link");
    card.setAttribute("tabindex", "0");

    card.addEventListener("click", (e) => {
      // If user clicked directly on an <a> or <button> inside the card, let that link handle it
      if (e.target.closest("a, button")) return;
      // Ignore text selection drags
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) return;

      window.open(primaryLink.href, "_blank", "noopener,noreferrer");
    });

    card.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && !e.target.closest("a, button")) {
        e.preventDefault();
        window.open(primaryLink.href, "_blank", "noopener,noreferrer");
      }
    });
  });

  // 7b. Chad Bercea Terminal TextScramble Effect on Hero Title ("Sudarshan GC")
  const scrambleTitle = document.getElementById("scramble-title");
  if (scrambleTitle && !prefersReducedMotion) {
    // Use compact characters that match serif glyph widths so text never expands/reflows
    const chars = "01/+*:;~-=xzcvbnm";
    let isScrambling = false;

    function getTextNodes(rootNode) {
      const nodes = [];
      const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, null, false);
      let n;
      while ((n = walker.nextNode())) {
        if (n.textContent.trim()) nodes.push(n);
      }
      return nodes;
    }

    const textNodes = getTextNodes(scrambleTitle);
    const originalTexts = textNodes.map((n) => n.textContent);
    const totalChars = originalTexts.reduce((sum, t) => sum + t.length, 0);

    function runScramble() {
      if (isScrambling) return;
      isScrambling = true;

      // Lock exact dimensions during scramble so the layout never shifts or flickers
      const rect = scrambleTitle.getBoundingClientRect();
      scrambleTitle.style.width = `${Math.ceil(rect.width)}px`;
      scrambleTitle.style.height = `${Math.ceil(rect.height)}px`;

      let frame = 0;
      const totalFrames = totalChars * 3;

      function step() {
        frame++;
        const progress = frame / totalFrames;
        textNodes.forEach((node, nodeIdx) => {
          const orig = originalTexts[nodeIdx];
          let out = "";
          for (let i = 0; i < orig.length; i++) {
            const ch = orig[i];
            const charProg = (nodeIdx * 10 + i) / totalChars;
            if (ch === " " || ch === "\n") {
              out += ch;
            } else if (progress > charProg + 0.3) {
              out += ch;
            } else {
              out += chars[Math.floor(Math.random() * chars.length)];
            }
          }
          node.textContent = out;
        });

        if (frame < totalFrames) {
          requestAnimationFrame(step);
        } else {
          textNodes.forEach((node, idx) => {
            node.textContent = originalTexts[idx];
          });
          scrambleTitle.style.width = "";
          scrambleTitle.style.height = "";
          isScrambling = false;
        }
      }
      requestAnimationFrame(step);
    }

    scrambleTitle.addEventListener("mouseenter", runScramble);
    setTimeout(runScramble, 450);
  }

  // 7c. Chad Bercea Terminal Scrolling Log Lines & Rotating ASCII Divider
  const terminalLogsContainer = document.getElementById("terminal-logs");
  const asciiDivider = document.getElementById("ascii-divider");
  const terminalLogsList = [
    "> compiling excuses for technical debt...",
    '[OK] bugs renamed to "features"',
    "> checking if anyone is reading this...",
    "[OK] coffee levels: critically low",
    "$ whoami -> backend engineer who likes to build stuff",
    "> googling Spring Boot stack trace...",
    "[OK] found stackoverflow answer from 2014",
    "> pushing to production on friday...",
    "[WARN] this is fine. everything is fine.",
    "$ git blame -> it was me. it's always me.",
    "> flushing Redis cache & hoping for the best...",
    "[OK] works on my machine™",
    "> pretending to understand distributed consensus...",
    "[OK] successfully nodded in architecture review",
    "$ sudo make me a sandwich -> okay."
  ];

  if (terminalLogsContainer && !prefersReducedMotion) {
    let logIdx = 1;
    function appendTerminalLog() {
      const text = terminalLogsList[logIdx % terminalLogsList.length];
      logIdx++;
      const line = document.createElement("div");
      line.className = "terminal-log-line";
      if (text.startsWith("[OK]")) line.classList.add("ok");
      else if (text.startsWith("[WARN]")) line.classList.add("warn");
      else if (text.startsWith("$")) line.classList.add("cmd-log");
      line.textContent = text;
      terminalLogsContainer.appendChild(line);

      setTimeout(() => {
        line.classList.add("fade-out");
        setTimeout(() => line.remove(), 900);
      }, 4200);

      while (terminalLogsContainer.children.length > 4) {
        terminalLogsContainer.firstChild.remove();
      }

      const nextDelay = 1400 + Math.random() * 1900;
      setTimeout(appendTerminalLog, nextDelay);
    }
    setTimeout(appendTerminalLog, 1600);
  }

  if (asciiDivider && !prefersReducedMotion) {
    const asciiPatterns = [
      "═══════════════════",
      "───────────────────",
      "┌──────────────────┐",
      "└──────────────────┘",
      "╔══════════════════╗",
      "╚══════════════════╝",
      "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓",
      "░░░░░░░░░░░░░░░░░░░",
      "├──────────────────┤"
    ];
    setInterval(() => {
      const p = asciiPatterns[Math.floor(Math.random() * asciiPatterns.length)];
      asciiDivider.textContent = p.repeat(12);
    }, 5000);
  }

  // 8. Hero Typewriter Cycling Effect
  const phrases = [
    "backend APIs that don't fall over.",
    "clean Spring Boot REST services.",
    "multi-tenant data pipelines.",
    "caching & rate-limiting layers."
  ];

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

  // 12. Spam-protected dynamic email link opener
  document.querySelectorAll(".js-email-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const u = link.getAttribute("data-user");
      const d = link.getAttribute("data-domain");
      if (u && d) {
        window.location.href = "mailto:" + u + "@" + d;
      }
    });
  });

  // 13. Interactive Particle Field Background (responsive to pointer, clicks & theme)
  const particleCanvas = document.getElementById("particle-canvas");
  if (particleCanvas && typeof window.ParticleField === "function") {
    try {
      particleEngine = new window.ParticleField(
        particleCanvas,
        root.getAttribute("data-theme") === "light" ? "light" : "dark"
      );
      particleEngine.resize();

      const themeObserver = new MutationObserver(() => {
        if (!particleEngine) return;
        const current = root.getAttribute("data-theme") === "light" ? "light" : "dark";
        particleEngine.syncTheme(current, true);
      });
      themeObserver.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

      if (prefersReducedMotion) {
        particleEngine.renderStatic();
        window.addEventListener("resize", () => {
          particleEngine.resize();
          particleEngine.renderStatic();
        });
      } else {
        let rafId = 0;
        let lastFrame = performance.now();
        let running = true;

        const frameLoop = (now) => {
          if (!running) return;
          const ms = now - lastFrame;
          lastFrame = now;
          particleEngine.frame(ms);
          rafId = requestAnimationFrame(frameLoop);
        };
        rafId = requestAnimationFrame(frameLoop);

        // Gentle initial pulse ripple after intro settle
        setTimeout(() => {
          if (running && particleEngine) {
            particleEngine.pulse(window.innerWidth * 0.52, window.innerHeight * 0.42);
          }
        }, 450);

        window.addEventListener(
          "pointermove",
          (e) => {
            particleEngine.setPointer(e.clientX, e.clientY);
          },
          { passive: true }
        );

        window.addEventListener(
          "pointerdown",
          (e) => {
            const target = e.target instanceof Element ? e.target : null;
            if (target && target.closest("button, a, input, select, textarea, [data-no-pulse]")) {
              return;
            }
            particleEngine.pulse(e.clientX, e.clientY);
          },
          { passive: true }
        );

        root.addEventListener("pointerleave", (e) => {
          if (!e.relatedTarget) {
            particleEngine.releasePointer();
          }
        });

        let resizeTimer = null;
        window.addEventListener("resize", () => {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => particleEngine.resize(), 120);
        });

        document.addEventListener("visibilitychange", () => {
          if (document.hidden) {
            running = false;
            cancelAnimationFrame(rafId);
          } else {
            running = true;
            lastFrame = performance.now();
            rafId = requestAnimationFrame(frameLoop);
          }
        });
      }
    } catch {
      // Fail silently if canvas context cannot be created
    }
  }
})();
