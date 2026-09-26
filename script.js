// Makes each folder button draggable within its own section container
// (it scrolls away with that section), and still clickable (a plain
// click, without dragging, fires the action).

document.addEventListener('DOMContentLoaded', () => {
  // ---------- Keep page content flush against the fixed nav bar ----------
  // The CSS derives the body's top padding and scroll offset from the
  // `--nav-height` custom property. Sync it to the nav's real rendered
  // height so content stays stuck to its edge no matter what changes the
  // nav's size (a new height value, the responsive wrap, font loading).
  const navBar = document.querySelector('.nav-bar');
  if (navBar) {
    const syncNavHeight = () => {
      document.documentElement.style.setProperty(
        '--nav-height',
        `${navBar.offsetHeight}px`
      );
    };

    syncNavHeight();
    window.addEventListener('load', syncNavHeight);
    window.addEventListener('resize', syncNavHeight);

    if ('ResizeObserver' in window) {
      new ResizeObserver(syncNavHeight).observe(navBar);
    }
  }

  const folders = document.querySelectorAll('.folder-button');

  folders.forEach((folder) => {
    // `pointerHeld`  – the mouse/finger is currently down on this folder.
    // `dragActive`   – a real drag is in progress (moved past the threshold),
    //                  so the folder has been pulled out of the grid flow.
    let pointerHeld = false;
    let dragActive = false;
    let hasMoved = false;
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;

    // The folder is only allowed to be dragged inside this element's box.
    // Landing-page folders are penned into `.container`; the About-page
    // folders fall back to `.about-content`, then to their parent.
    const bounds =
      folder.closest('.container, .about-content') || folder.parentElement;

    // Keep a value between a lower and upper limit.
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    // The grid that lays the folders out. Once a folder is pulled out of the
    // flow (position: absolute) the grid loses an item and its rows collapse,
    // which shortens `.main-row` and lets `.container`'s vertical centering
    // drag `.home-path` downwards. Locking the grid's rendered size on the
    // first drag keeps every sibling — and the path above it — put.
    const grid = folder.closest('.buttons');

    const freezeGridSize = () => {
      if (!grid || grid.dataset.sizeLocked) return;
      const gridRect = grid.getBoundingClientRect();
      grid.style.minWidth = `${gridRect.width}px`;
      grid.style.minHeight = `${gridRect.height}px`;
      grid.dataset.sizeLocked = 'true';
    };

    // Pull the folder out of the grid flow into absolute positioning at the
    // exact spot it currently occupies. This is deferred until the pointer
    // has actually moved past the drag threshold — a plain click never runs
    // it, so the sibling folders never reflow and pile on top of the one
    // being clicked as the page loads.
    const beginDrag = () => {
      if (folder.style.position === 'absolute') {
        // Already dragged once; continue from where it was dropped.
        originLeft = parseFloat(folder.style.left) || 0;
        originTop = parseFloat(folder.style.top) || 0;
      } else {
        const rect = folder.getBoundingClientRect();
        const boundsRect = bounds.getBoundingClientRect();

        freezeGridSize();

        // Position relative to the container, so the folder scrolls away
        // with its section instead of floating over the whole page.
        originLeft = rect.left - boundsRect.left + bounds.scrollLeft;
        originTop = rect.top - boundsRect.top + bounds.scrollTop;

        folder.style.position = 'absolute';
        folder.style.left = `${originLeft}px`;
        folder.style.top = `${originTop}px`;
        folder.style.margin = '0';
      }

      folder.classList.add('dragging');
      dragActive = true;
    };

    const onPointerDown = (e) => {
      const point = e.touches ? e.touches[0] : e;

      pointerHeld = true;
      dragActive = false;
      hasMoved = false;
      startX = point.clientX;
      startY = point.clientY;

      document.addEventListener('mousemove', onPointerMove);
      document.addEventListener('mouseup', onPointerUp);
      document.addEventListener('touchmove', onPointerMove, { passive: false });
      document.addEventListener('touchend', onPointerUp);
    };

    const onPointerMove = (e) => {
      if (!pointerHeld) return;

      const point = e.touches ? e.touches[0] : e;
      const dx = point.clientX - startX;
      const dy = point.clientY - startY;

      // Stay a plain click until the pointer travels past the threshold.
      if (!hasMoved && Math.abs(dx) <= 3 && Math.abs(dy) <= 3) return;
      hasMoved = true;

      if (!dragActive) beginDrag();
      if (e.cancelable) e.preventDefault();

      // Clamp within the container's own box (coordinates are now
      // relative to the container, so the range starts at 0).
      const maxLeft = bounds.clientWidth - folder.offsetWidth;
      const maxTop = bounds.clientHeight - folder.offsetHeight;

      folder.style.left = `${clamp(originLeft + dx, 0, maxLeft)}px`;
      folder.style.top = `${clamp(originTop + dy, 0, maxTop)}px`;
    };

    const onPointerUp = () => {
      pointerHeld = false;
      dragActive = false;
      folder.classList.remove('dragging');

      document.removeEventListener('mousemove', onPointerMove);
      document.removeEventListener('mouseup', onPointerUp);
      document.removeEventListener('touchmove', onPointerMove);
      document.removeEventListener('touchend', onPointerUp);
    };

    folder.addEventListener('mousedown', onPointerDown);
    folder.addEventListener('touchstart', onPointerDown, { passive: true });

    // Prevent the click/navigation action from firing right after a drag.
    folder.addEventListener('click', (e) => {
      if (hasMoved) {
        e.preventDefault();
        e.stopPropagation();
        hasMoved = false;
        return;
      }

      const target = folder.getAttribute('data-target');
      const section = target && document.getElementById(target);

      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        console.log(`Opened folder: ${target}`);
      }
    });
  });

  // ---------- Pop-up windows (double-click an icon) ----------
  // Any icon with a `data-target` (About-page: current-favs / interests;
  // Projects-page: portfolio-website / knowlabel) opens the matching
  // `#modal-<target>` window, wherever it lives on the page. Each modal
  // overlay (`.about-modal-overlay`) only ever shows its own modals.
  const modalOverlays = document.querySelectorAll('.about-modal-overlay');

  if (modalOverlays.length) {
    const modalIcons = document.querySelectorAll('[data-target]');
    let lastFocused = null;

    const openModal = (name) => {
      const modal = document.getElementById(`modal-${name}`);
      if (!modal) return;
      const overlay = modal.closest('.about-modal-overlay');
      if (!overlay) return;

      lastFocused = document.activeElement;
      overlay.querySelectorAll('.about-modal').forEach((m) => {
        m.hidden = m !== modal;
      });
      overlay.hidden = false;
      document.body.classList.add('modal-open');

      const closeBtn = modal.querySelector('.dot-close');
      if (closeBtn) closeBtn.focus();
    };

    const closeModal = (overlay) => {
      overlay.hidden = true;
      document.body.classList.remove('modal-open');
      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus();
      }
    };

    modalIcons.forEach((icon) => {
      icon.addEventListener('dblclick', () => {
        const target = icon.getAttribute('data-target');
        if (target && document.getElementById(`modal-${target}`)) {
          openModal(target);
        }
      });
    });

    modalOverlays.forEach((overlay) => {
      overlay.querySelectorAll('.dot-close').forEach((btn) => {
        btn.addEventListener('click', () => closeModal(overlay));
      });

      // Click on the blurred backdrop (outside the window) closes it.
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal(overlay);
      });
    });

    // Esc closes whichever overlay is open.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      modalOverlays.forEach((overlay) => {
        if (!overlay.hidden) closeModal(overlay);
      });
    });
  }

  // ---------- Photo carousel (About Me page) ----------
  let carouselImageEl = document.getElementById('carousel-image');
  const carouselFilenameEl = document.getElementById('carousel-filename');
  const prevBtn = document.querySelector('.carousel-arrow.prev');
  const nextBtn = document.querySelector('.carousel-arrow.next');

  if (carouselImageEl && prevBtn && nextBtn) {
    // Add more { src, filename } entries here as more photos are added.
    const photos = [
      { src: 'assets/matchas.jpg', filename: 'yummy-matcha.jpg' },
      { src: 'assets/caitlyn-pic.jpg', filename: 'caitlyn-pic.jpg' },
      { src: 'assets/bao-bao.jpg', filename: 'bao-bao.jpg' },
      { src: 'assets/fav-people.jpg', filename: 'fav-people.jpg' },
    ];

    const imageArea = carouselImageEl.parentElement;
    const SLIDE_MS = 450;
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    let currentPhoto = 0;
    let isSwitching = false;

    const setFilename = (photo) => {
      carouselImageEl.alt = photo.filename;
      if (carouselFilenameEl) carouselFilenameEl.textContent = photo.filename;
    };

    // Slide to `photos[currentPhoto]`. direction === 1 (next): the new photo
    // enters from the right and slides left; the old one exits to the left.
    // direction === -1 (previous): the new photo enters from the left and
    // slides right; the old one exits to the right.
    const slideToPhoto = (direction) => {
      const photo = photos[currentPhoto];

      if (prefersReducedMotion || !direction) {
        carouselImageEl.src = photo.src;
        setFilename(photo);
        return;
      }

      isSwitching = true;

      // Preload so the incoming photo is fully painted before it slides in.
      const preloaded = new Image();
      preloaded.onload = preloaded.onerror = () => {
        const outgoing = carouselImageEl;
        const incoming = outgoing.cloneNode(false);
        incoming.removeAttribute('id');
        incoming.src = photo.src;
        incoming.style.transition = 'none';
        incoming.style.transform = `translateX(${direction * 100}%)`;
        imageArea.insertBefore(incoming, outgoing.nextSibling);

        // Force a reflow so the starting transform is committed before we
        // switch the transition back on and animate to the resting position.
        void incoming.offsetWidth;

        incoming.style.transition = `transform ${SLIDE_MS}ms ease`;
        outgoing.style.transition = `transform ${SLIDE_MS}ms ease`;
        incoming.style.transform = 'translateX(0)';
        outgoing.style.transform = `translateX(${-direction * 100}%)`;

        carouselImageEl = incoming;
        setFilename(photo);

        let finished = false;
        const done = () => {
          if (finished) return;
          finished = true;
          outgoing.remove();
          incoming.id = 'carousel-image';
          incoming.style.transition = '';
          incoming.style.transform = '';
          isSwitching = false;
        };
        incoming.addEventListener('transitionend', done, { once: true });
        setTimeout(done, SLIDE_MS + 80);
      };
      preloaded.src = photo.src;
    };

    const step = (direction) => {
      if (isSwitching) return;
      currentPhoto =
        (currentPhoto + direction + photos.length) % photos.length;
      slideToPhoto(direction);
    };

    prevBtn.addEventListener('click', () => step(-1));
    nextBtn.addEventListener('click', () => step(1));

    slideToPhoto(0);
  }
});
