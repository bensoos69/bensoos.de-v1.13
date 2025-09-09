document.addEventListener('DOMContentLoaded', function() {
    // FIX: Cast querySelector results to specific HTMLElement types for type safety.
    const navIsland = document.querySelector<HTMLElement>('.dynamic-island');
    const navTabs = document.querySelector<HTMLElement>('.nav-tabs');
    const liquidGlass = document.querySelector<HTMLElement>('.liquid-glass');
    // FIX: Cast querySelectorAll results to an array of HTMLLabelElement for type safety.
    const allLabels = Array.from(document.querySelectorAll<HTMLLabelElement>('.nav-tabs label'));
    const contentSections = allLabels
        .map(label => {
            // FIX: The type of `label` is now HTMLLabelElement, so `dataset` is available.
            const targetId = label.dataset.target;
            return targetId ? document.querySelector(targetId) : null;
        })
        .filter(Boolean) as HTMLElement[];

    let scrollMap: { labelLeft: number, sectionTop: number }[] = [];

    // ULTIMATE: Konfigurierbare Parameter
    let config = {
        posStiffness: 0.08, posDamping: 0.7,
        widthStiffness: 0.1, widthDamping: 0.7,
        enableStretch: true, enableSnap: true,
        stretchStrength: 0.15
    };

    const bouncePresets: { [key: string]: { stiffness: number, damping: number, name: string } } = {
        '1': { stiffness: 0.12, damping: 0.8, name: 'Subtle' },
        '2': { stiffness: 0.08, damping: 0.7, name: 'Medium' },
        '3': { stiffness: 0.05, damping: 0.6, name: 'Bouncy' }
    };

    let isDragging = false;
    let navAnimationFrame: number | null = null;
    let position = 0, velocity = 0, target = 0;
    let width = 0, widthVelocity = 0, widthTarget = 0;
    let scaleX = 1, scaleXVelocity = 0, scaleXTarget = 1;
    let scaleY = 1, scaleYVelocity = 0, scaleYTarget = 1;

    let scrollAnimationFrame: number | null = null;
    let scrollAnimationStartTime: number | null = null;
    const scrollAnimationDuration = 1100; 
    let scrollAnimationStartPos = 0;
    let scrollAnimationTargetPos = 0;

    function easeInOutQuart(t: number) {
        return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
    }

    function setupControlPanel() {
        // FIX: Cast getElementById results to specific HTML element types.
        const bounceSlider = document.getElementById('bounceSlider') as HTMLInputElement;
        const bounceValue = document.getElementById('bounceValue') as HTMLElement;
        const stretchToggle = document.getElementById('stretchToggle') as HTMLInputElement;
        const stretchSlider = document.getElementById('stretchSlider') as HTMLInputElement;
        const stretchValue = document.getElementById('stretchValue') as HTMLElement;
        const snapToggle = document.getElementById('snapToggle') as HTMLInputElement;

        if (!bounceSlider || !bounceValue || !stretchToggle || !stretchSlider || !stretchValue || !snapToggle) return;

        bounceSlider.addEventListener('input', (e) => {
            // FIX: Cast event target to HTMLInputElement to access `value`.
            const target = e.target as HTMLInputElement;
            const preset = bouncePresets[target.value];
            if (preset) {
                config.posStiffness = preset.stiffness;
                config.posDamping = preset.damping;
                bounceValue.textContent = preset.name;
            }
        });
        stretchToggle.addEventListener('change', (e) => { 
            // FIX: Cast event target to HTMLInputElement to access `checked`.
            config.enableStretch = (e.target as HTMLInputElement).checked; 
        });
        stretchSlider.addEventListener('input', (e) => {
            // FIX: Cast event target to HTMLInputElement to access `value`.
            const target = e.target as HTMLInputElement;
            config.stretchStrength = Number(target.value) / 100;
            stretchValue.textContent = target.value + '%';
        });
        snapToggle.addEventListener('change', (e) => { 
            // FIX: Cast event target to HTMLInputElement to access `checked`.
            config.enableSnap = (e.target as HTMLInputElement).checked; 
        });
    }

    function updateScrollMap() {
        scrollMap = allLabels
            .map(label => {
                // FIX: `label` is now correctly typed as HTMLLabelElement.
                const targetId = label.dataset.target;
                if (!targetId) return null;
                // FIX: Cast querySelector result to HTMLElement for `offsetTop`.
                const section = document.querySelector<HTMLElement>(targetId);
                if (!section) return null;
                return { labelLeft: label.offsetLeft, sectionTop: section.offsetTop };
            })
            .filter((item): item is { labelLeft: number, sectionTop: number } => Boolean(item));
    }

    // FIX: Add type annotation for the `label` parameter.
    function selectCategory(label: HTMLLabelElement | null, shouldScroll = true) {
        if (!label) return;

        // Save the last active main category label
        if (label.dataset.target && label.id !== 'contact-label') {
            lastActiveMainLabel = label;
        }

        if (label.dataset.url) {
            window.open(label.dataset.url, '_blank');
            shouldScroll = false; 
        }
        
        target = label.offsetLeft;
        widthTarget = label.offsetWidth;
        startNavPhysicsLoop();

        const radioId = label.getAttribute('for');
        if (radioId) {
            // FIX: Cast getElementById result to HTMLInputElement for `checked` property.
            const radio = document.getElementById(radioId) as HTMLInputElement;
            if (radio) radio.checked = true;
        }
        
        if (shouldScroll) {
            const targetId = label.dataset.target;
            if (targetId) {
                // FIX: Cast querySelector result to HTMLElement for `offsetTop`.
                const targetElement = document.querySelector<HTMLElement>(targetId);
                if (targetElement) startScrollAnimation(targetElement.offsetTop);
            }
        }
    }

    function navPhysicsLoop() {
        if (!liquidGlass) return;

        const posForce = -config.posStiffness * (position - target);
        velocity = (velocity + posForce) * config.posDamping;
        position += velocity;

        const widthForce = -config.widthStiffness * (width - widthTarget);
        widthVelocity = (widthVelocity + widthForce) * config.widthDamping;
        width += widthVelocity;
        
        const scaleXForce = -config.widthStiffness * (scaleX - scaleXTarget);
        scaleXVelocity = (scaleXVelocity + scaleXForce) * config.widthDamping;
        scaleX += scaleXVelocity;

        const scaleYForce = -config.widthStiffness * (scaleY - scaleYTarget);
        scaleYVelocity = (scaleYVelocity + scaleYForce) * config.widthDamping;
        scaleY += scaleYVelocity;

        // FIX: `liquidGlass` is now correctly typed as HTMLElement, so `style` is accessible.
        liquidGlass.style.transform = `translateX(${position}px) scale(${scaleX}, ${scaleY})`;
        liquidGlass.style.width = `${width}px`;

        if (Math.abs(velocity) < 0.01 && Math.abs(position - target) < 0.01 &&
            Math.abs(widthVelocity) < 0.01 && Math.abs(width - widthTarget) < 0.01 &&
            Math.abs(scaleXVelocity) < 0.001 && Math.abs(scaleX - scaleXTarget) < 0.001 &&
            Math.abs(scaleYVelocity) < 0.001 && Math.abs(scaleY - scaleYTarget) < 0.001 && !isDragging) {
            stopNavPhysicsLoop();
            position = target;
            width = widthTarget;
            scaleX = scaleXTarget;
            scaleY = scaleYTarget;
            // FIX: `liquidGlass` is now correctly typed as HTMLElement, so `style` is accessible.
            liquidGlass.style.transform = `translateX(${position}px) scale(${scaleX}, ${scaleY})`;
            liquidGlass.style.width = `${width}px`;
        } else {
            navAnimationFrame = requestAnimationFrame(navPhysicsLoop);
        }
    }

    function scrollAnimationLoop(timestamp: number) {
        if (!scrollAnimationStartTime) scrollAnimationStartTime = timestamp;
        const progress = Math.min((timestamp - scrollAnimationStartTime) / scrollAnimationDuration, 1);
        window.scrollTo(0, scrollAnimationStartPos + (scrollAnimationTargetPos - scrollAnimationStartPos) * easeInOutQuart(progress));
        if (progress < 1) scrollAnimationFrame = requestAnimationFrame(scrollAnimationLoop);
        else stopScrollAnimation();
    }

    function startNavPhysicsLoop() {
        if (!navAnimationFrame) navAnimationFrame = requestAnimationFrame(navPhysicsLoop);
    }
    function stopNavPhysicsLoop() {
        if (navAnimationFrame) cancelAnimationFrame(navAnimationFrame);
        navAnimationFrame = null;
    }
    function startScrollAnimation(targetY: number) {
        if (scrollAnimationFrame) cancelAnimationFrame(scrollAnimationFrame);
        scrollAnimationStartTime = null;
        scrollAnimationStartPos = window.scrollY;
        scrollAnimationTargetPos = targetY;
        if (scrollAnimationStartPos !== scrollAnimationTargetPos) {
            scrollAnimationFrame = requestAnimationFrame(scrollAnimationLoop);
        }
    }
    function stopScrollAnimation() {
        if (scrollAnimationFrame) cancelAnimationFrame(scrollAnimationFrame);
        scrollAnimationFrame = null;
    }

    let startX: number, initialLeft: number;
    function onDragStart(e: MouseEvent | TouchEvent) {
        if (!liquidGlass || !navTabs) return;

        const rect = liquidGlass.getBoundingClientRect();
        const clientX = e.type === 'touchstart' ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = e.type === 'touchstart' ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
        if (!(clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom)) return;

        e.preventDefault();
        isDragging = true;
        stopScrollAnimation();
        navTabs.classList.add('is-dragging');
        startX = clientX;
        initialLeft = position;
        document.body.style.cursor = 'grabbing';
        startNavPhysicsLoop();
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('touchmove', onDragMove, { passive: false });
        document.addEventListener('mouseup', onDragEnd);
        document.addEventListener('touchend', onDragEnd);
    }

    function onDragMove(e: MouseEvent | TouchEvent) {
        if (!isDragging || !navTabs || !liquidGlass) return;
        e.preventDefault();
        
        const currentX = e.type === 'touchmove' ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
        const currentY = e.type === 'touchmove' ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

        const dx = currentX - startX;
        const dragPosition = initialLeft + dx;

        let closestLabel;
        if (config.enableSnap) {
            const navTabsRect = navTabs.getBoundingClientRect();
            const mouseOffsetInNav = currentX - navTabsRect.left;
            closestLabel = findClosestLabelByPosition(mouseOffsetInNav);
        } else {
            closestLabel = findClosestLabel(dragPosition);
        }

        if (closestLabel && target !== closestLabel.offsetLeft) {
            target = closestLabel.offsetLeft;
            widthTarget = closestLabel.offsetWidth;
        }
        
        if (scrollMap.length > 1) {
            const firstLabelPos = scrollMap[0].labelLeft;
            const lastScrollMapEntry = scrollMap[scrollMap.length - 1];
            const lastLabelPos = lastScrollMapEntry.labelLeft;
            const clampedDragPosition = Math.max(firstLabelPos, Math.min(dragPosition, lastLabelPos));
            let prevPoint: { labelLeft: number; sectionTop: number; } | null = null, nextPoint: { labelLeft: number; sectionTop: number; } | null = null;
            for (const point of scrollMap) {
                if (point.labelLeft <= clampedDragPosition) prevPoint = point;
                else { nextPoint = point; break; }
            }
            if (prevPoint) {
                let newScrollY;
                if (!nextPoint) newScrollY = prevPoint.sectionTop;
                else {
                    const labelSegmentLength = nextPoint.labelLeft - prevPoint.labelLeft;
                    if (labelSegmentLength > 0) {
                        const progress = (clampedDragPosition - prevPoint.labelLeft) / labelSegmentLength;
                        const sectionSegmentLength = nextPoint.sectionTop - prevPoint.sectionTop;
                        newScrollY = prevPoint.sectionTop + (progress * sectionSegmentLength);
                    } else newScrollY = prevPoint.sectionTop;
                }
                window.scrollTo({ top: newScrollY, behavior: 'instant' });
            }
        }

        if (config.enableStretch) {
            const rect = liquidGlass.getBoundingClientRect();
            const deltaX = currentX - (rect.left + rect.width / 2);
            const deltaY = currentY - (rect.top + rect.height / 2);
            const normalizedX = deltaX / (rect.width / 2);
            const normalizedY = deltaY / (rect.height / 2);
            const clampedX = Math.max(-1, Math.min(1, normalizedX));
            const clampedY = Math.max(-1, Math.min(1, normalizedY));
            scaleXTarget = 1 + Math.abs(clampedX) * config.stretchStrength - Math.abs(clampedY) * (config.stretchStrength / 2);
            scaleYTarget = 1 + Math.abs(clampedY) * config.stretchStrength - Math.abs(clampedX) * (config.stretchStrength / 2);
        }
    }

    function onDragEnd() {
        if (!isDragging || !navTabs) return;
        isDragging = false;
        navTabs.classList.remove('is-dragging');
        document.body.style.cursor = '';

        if (config.enableStretch) {
            scaleXTarget = 1;
            scaleYTarget = 1;
        }
        
        const closestLabel = findClosestLabel(position);
        selectCategory(closestLabel, true);
        
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('touchmove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        document.removeEventListener('touchend', onDragEnd);
    }

    function syncNavWithScroll() {
        // If in contact mode (clicked) or temporary hover state, revert to main categories first.
        if (isContactMode || lastCheckedIdBeforeHover) {
            if (isContactMode) {
                isContactMode = false;
                if (contactLabel) contactLabel.textContent = 'Kontakt';
            }
            switchNavLabels(mainNavItems);
            lastCheckedIdBeforeHover = null; 
        }
        
        if (scrollAnimationFrame || isDragging) return;
        
        const middleOfViewport = window.scrollY + window.innerHeight / 2;
        let currentActiveSection: HTMLElement = contentSections[0];
        for (const section of contentSections) {
            if (section.offsetTop <= middleOfViewport) {
                currentActiveSection = section;
            } else {
                break;
            }
        }
        
        if (currentActiveSection) {
            const id = currentActiveSection.getAttribute('id');
            // FIX: Cast querySelector result to HTMLLabelElement for `offsetLeft`.
            const newActiveLabel = document.querySelector<HTMLLabelElement>(`.nav-tabs label[data-target="#${id}"]`);
            if (newActiveLabel && newActiveLabel.offsetLeft !== target) {
                selectCategory(newActiveLabel, false);
            }
        }
    }

    function findClosestLabel(currentPos: number) {
        return allLabels.reduce((closest, label) => {
            const box = label.getBoundingClientRect(), closestBox = closest.getBoundingClientRect();
            const navTabsRect = navTabs ? navTabs.getBoundingClientRect() : { left: 0 };
            const dist = Math.abs(currentPos - (box.left - navTabsRect.left));
            const closestDist = Math.abs(currentPos - (closestBox.left - navTabsRect.left));
            return dist < closestDist ? label : closest;
        });
    }

    function findClosestLabelByPosition(mouseOffset: number) {
        let closest = allLabels[0], minDistance = Infinity;
        allLabels.forEach(label => {
            // FIX: `label` is now correctly typed as HTMLLabelElement, so `offsetLeft` and `offsetWidth` are accessible.
            const labelCenter = label.offsetLeft + label.offsetWidth / 2;
            const dist = Math.abs(mouseOffset - labelCenter);
            if (dist < minDistance) { minDistance = dist; closest = label; }
        });
        return closest;
    }
    
    function handleManualScroll() {
        if (scrollAnimationFrame) stopScrollAnimation();
    }

    function init() {
        updateScrollMap();
        // FIX: Cast querySelector result to HTMLInputElement.
        const initiallyChecked = document.querySelector<HTMLInputElement>('.nav-tabs input[type="radio"]:checked');
        if (initiallyChecked) {
            // FIX: Cast nextElementSibling to HTMLLabelElement.
            const label = initiallyChecked.nextElementSibling as HTMLLabelElement;
            if (label && liquidGlass) {
                position = target = label.offsetLeft;
                width = widthTarget = label.offsetWidth;
                scaleX = scaleXTarget = 1;
                scaleY = scaleYTarget = 1;
                // FIX: `liquidGlass` is now correctly typed, `style` is accessible.
                liquidGlass.style.transform = `translateX(${position}px) scale(${scaleX}, ${scaleY})`;
                liquidGlass.style.width = `${width}px`;
                // Set initial last active label
                // FIX: `label` is correctly typed, `dataset` is accessible.
                if (label.dataset.target) {
                    lastActiveMainLabel = label;
                }
            }
        }
    }
    
    // --- Contact Button Interaction Logic ---
    const mainNavItems = [
        { text: 'Events', target: '#events' },
        { text: 'Mediathek', target: '#mediathek' },
        { text: 'Projekte', target: '#projekte' },
        { text: 'Produkte', target: '#produkte' }
    ];
    const contactNavItems = [
        { text: 'Discord', url: 'https://discord.gg/8PncfAUY' },
        { text: 'E-Mail', url: 'mailto:kontakt@bensoos.de?subject=Kontaktanfrage von der bensoo.de' },
        { text: 'Instagram', url: 'https://ig.me/m/bensoos69' },
        { text: 'Teams', url: 'https://teams.microsoft.com/' },
        { text: 'Zoom', url: 'https://zoom.us/join' }
    ];
    let isContactMode = false;
    let lastCheckedIdBeforeHover: string | null = null;
    let lastActiveMainLabel: HTMLLabelElement | null = null; // Store the last main category for click-revert
    // FIX: Cast querySelector results to HTMLLabelElement.
    const logoLabel = document.querySelector<HTMLLabelElement>('label[for="switch-0"]');
    const contactLabel = document.querySelector<HTMLLabelElement>('#contact-label');
    // FIX: Cast querySelector results to HTMLLabelElement.
    const navLabelsToChange = [
        document.querySelector<HTMLLabelElement>('label[for="switch-1"]'),
        document.querySelector<HTMLLabelElement>('label[for="switch-2"]'),
        document.querySelector<HTMLLabelElement>('label[for="switch-3"]'),
        document.querySelector<HTMLLabelElement>('label[for="switch-4"]')
    ];

    function switchNavLabels(items: typeof mainNavItems | typeof contactNavItems) {
        const isContact = items === contactNavItems;
        items.forEach((item, index) => {
            const label = navLabelsToChange[index];
            if (label) {
                label.textContent = item.text;
                if (isContact && 'url' in item) {
                    // FIX: `label` is now correctly typed as HTMLLabelElement, so `dataset` is accessible.
                    label.dataset.url = item.url;
                    delete label.dataset.target;
                } else if (!isContact && 'target' in item) {
                    // FIX: `label` is now correctly typed as HTMLLabelElement, so `dataset` is accessible.
                    label.dataset.target = item.target;
                    delete label.dataset.url;
                }
            }
        });
        updateScrollMap();
    }

    if (contactLabel) {
        contactLabel.addEventListener('click', () => {
            isContactMode = !isContactMode;
            lastCheckedIdBeforeHover = null; // Disable hover-revert after a click

            if (isContactMode) {
                // Switched TO contact mode
                contactLabel.textContent = 'Kategorien';
                switchNavLabels(contactNavItems);
                selectCategory(contactLabel, false); // Animate glass to the button
            } else {
                // Switched BACK to main categories mode
                contactLabel.textContent = 'Kontakt';
                switchNavLabels(mainNavItems);
                
                // Restore selection to the last main category, without scrolling
                const targetLabel = lastActiveMainLabel || logoLabel; // Fallback to logo
                selectCategory(targetLabel, false);
            }
        });
    }
    
    if (logoLabel) {
        logoLabel.addEventListener('click', () => {
            if (isContactMode) {
                isContactMode = false;
                if (contactLabel) contactLabel.textContent = 'Kontakt';
                switchNavLabels(mainNavItems);
            }
        });
    }

    if (contactLabel) {
        contactLabel.addEventListener('mouseenter', () => {
            if (isContactMode) return;

            // FIX: Cast querySelector result to HTMLInputElement.
            const currentlyChecked = document.querySelector<HTMLInputElement>('.nav-tabs input[type="radio"]:checked');
            lastCheckedIdBeforeHover = currentlyChecked ? currentlyChecked.id : 'switch-0';
            
            selectCategory(contactLabel, false);
            switchNavLabels(contactNavItems);
        });
    }

    if (navIsland) {
        navIsland.addEventListener('mouseleave', () => {
            // Fall 1: Im Kontakt-Modus. Bei Verlassen der Leiste zum "Kategorien"-Button zurückkehren.
            if (isContactMode) {
                selectCategory(contactLabel, false);
                return;
            }
        
            // Fall 2: Nicht im Kontakt-Modus, aber temporär über "Kontakt" gehovert.
            // Wenn kein temporärer Hover-Zustand vorliegt, nichts tun.
            if (!lastCheckedIdBeforeHover) return;
        
            // Zurück zum Hauptmenü wechseln.
            switchNavLabels(mainNavItems);
        
            // Das Label wiederherstellen, das vor dem Hover aktiv war.
            // FIX: Cast querySelector result to HTMLLabelElement.
            const labelToRestore = document.querySelector<HTMLLabelElement>(`label[for="${lastCheckedIdBeforeHover}"]`);
            
            if (labelToRestore) {
                selectCategory(labelToRestore, false);
            }
            
            // Temporären Hover-Zustand löschen.
            lastCheckedIdBeforeHover = null;
        });
    }

    allLabels.forEach(label => label.addEventListener('click', function(this: HTMLLabelElement) { 
        if (this.dataset.url) {
            if (!isContactMode && lastCheckedIdBeforeHover) {
               selectCategory(this, true);
               return;
            }
        }
        selectCategory(this); 
    }));

    // --- Scroll Effects (Fade-in) ---
    // FIX: Cast querySelectorAll result to NodeListOf<HTMLElement>.
    const elementsForEffects = document.querySelectorAll<HTMLElement>('.content-card, .section-title, .hero h1, .hero p, .hero .btn-container-for-animation');

    // Observer for the fade-in animation, which now triggers every time an element enters the view.
    const fadeInObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            // FIX: Cast entry.target to HTMLElement for classList and style.
            const target = entry.target as HTMLElement;
            if (entry.isIntersecting) {
                // Element is entering the viewport
                target.style.removeProperty('opacity');
                target.classList.add('animate-fade-in');
            } else {
                // Element is leaving the viewport
                // Reset the state so the animation can trigger again on re-entry.
                target.classList.remove('animate-fade-in');
                target.style.opacity = '0'; // Re-hide the element
            }
        });
    }, { threshold: 0.1 });

    // Prepare elements for animations: start hidden and observe
    elementsForEffects.forEach(el => {
        // FIX: `el` is now correctly typed as HTMLElement, so `style` is accessible.
        el.style.opacity = '0';
        fadeInObserver.observe(el);
    });
    
    // --- Responsive Grid Layout ---
    function initializeResponsiveGrids() {
        const grids = document.querySelectorAll<HTMLElement>('.content-grid');

        grids.forEach(grid => {
            const items = Array.from(grid.children) as HTMLElement[];
            if (items.length === 0) return;

            const updateLayout = () => {
                const containerWidth = grid.clientWidth;
                
                let columns = 1;
                if (containerWidth > 1024) {
                    columns = 3;
                } else if (containerWidth > 700) {
                    columns = 2;
                }

                const gap = 30; 
                const totalGapWidth = (columns - 1) * gap;
                const itemWidth = (containerWidth - totalGapWidth) / columns;
                
                items[0].style.width = `${itemWidth}px`;
                items[0].style.height = ``; 
                grid.getBoundingClientRect(); 
                const itemHeight = items[0].offsetHeight;

                items.forEach((item, index) => {
                    const col = index % columns;
                    const row = Math.floor(index / columns);

                    const x = col * (itemWidth + gap);
                    const y = row * (itemHeight + gap);

                    item.style.width = `${itemWidth}px`;
                    item.style.height = `${itemHeight}px`;
                    item.style.setProperty('--tx', `${x}px`);
                    item.style.setProperty('--ty', `${y}px`);
                });

                const numRows = Math.ceil(items.length / columns);
                const containerHeight = numRows * itemHeight + (numRows > 0 ? (numRows - 1) * gap : 0);
                grid.style.height = `${containerHeight}px`;
            };

            const resizeObserver = new ResizeObserver(() => {
                window.requestAnimationFrame(updateLayout);
            });

            resizeObserver.observe(grid);
            updateLayout(); 
        });
    }
    
    function debounce(func: (...args: any[]) => void, wait = 20): (...args: any[]) => void {
        let timeout: number | undefined;
        return function(this: any, ...args: any[]) {
            const context = this;
            const later = function() {
                timeout = undefined;
                func.apply(context, args);
            };
            clearTimeout(timeout);
            timeout = window.setTimeout(later, wait);
        };
    }

    // Initialize everything
    setupControlPanel();
    init();
    initializeResponsiveGrids();

    if (navTabs) {
        navTabs.addEventListener('mousedown', onDragStart as EventListener);
        navTabs.addEventListener('touchstart', onDragStart as EventListener, { passive: false });
    }
    window.addEventListener('resize', debounce(() => {
        stopNavPhysicsLoop();
        init();
    }, 150));
    window.addEventListener('wheel', handleManualScroll, { passive: true });
    window.addEventListener('touchstart', handleManualScroll, { passive: true });
    window.addEventListener('scroll', syncNavWithScroll, { passive: true });

    // --- Glassmorphism Button Logic ---
    (function () {
        // FIX: Cast getElementById result to HTMLElement.
        const btn = document.getElementById('followBtn');
        if (!btn) return;

        // FIX: Cast querySelector results to HTMLElement.
        const inner = btn.querySelector<HTMLElement>('.btn__inner');
        const label = btn.querySelector<HTMLElement>('.btn__label');
        if (!inner || !label) return;
        
        const DAMPING_FACTOR = 0.15;
        const BUTTON_MOVE_STRENGTH = 0.3;
        const MAX_TEXT_TRANSLATE = 12;
        const MAX_STRETCH = 0.15;
        const MIN_TEXT_SCALE = 0.90;

        let rafId: number | null = null;
        let isPressed = false;

        const current = { x: 0, y: 0, scaleX: 1, scaleY: 1, textX: 0, textY: 0, textScale: 1 };
        const target = { x: 0, y: 0, scaleX: 1, scaleY: 1, textX: 0, textY: 0, textScale: 1 };

        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        function lerp(start: number, end: number, amount: number) {
            return start + (end - start) * amount;
        }

        function animate() {
            current.x = lerp(current.x, target.x, DAMPING_FACTOR);
            current.y = lerp(current.y, target.y, DAMPING_FACTOR);
            current.scaleX = lerp(current.scaleX, target.scaleX, DAMPING_FACTOR);
            current.scaleY = lerp(current.scaleY, target.scaleY, DAMPING_FACTOR);
            current.textX = lerp(current.textX, target.textX, DAMPING_FACTOR);
            current.textY = lerp(current.textY, target.textY, DAMPING_FACTOR);
            current.textScale = lerp(current.textScale, target.textScale, DAMPING_FACTOR);
            
            const btnTransform = `translate(${current.x}px, ${current.y}px) scale(${current.scaleX}, ${current.scaleY})`;
            const labelTransform = `translate(${current.textX}px, ${current.textY}px) scale(${current.textScale})`;
            
            // FIX: `btn` and `label` are now correctly typed as HTMLElement, so `style` is accessible.
            btn.style.transform = btnTransform;
            label.style.transform = labelTransform;

            rafId = requestAnimationFrame(animate);
        }

        function onMove(e: MouseEvent) {
            if (prefersReducedMotion || isPressed) return;
            
            const r = btn.getBoundingClientRect();
            const deltaX = e.clientX - (r.left + r.width / 2);
            const deltaY = e.clientY - (r.top + r.height / 2);
            
            target.x = deltaX * BUTTON_MOVE_STRENGTH;
            target.y = deltaY * BUTTON_MOVE_STRENGTH;

            const normalizedX = deltaX / (r.width / 2);
            const normalizedY = deltaY / (r.height / 2);
            const clampedX = Math.max(-1, Math.min(1, normalizedX));
            // FIX: Corrected a typo where clampedY was being defined using its own value instead of normalizedY.
            const clampedY = Math.max(-1, Math.min(1, normalizedY));

            target.scaleX = 1 + Math.abs(clampedX) * MAX_STRETCH - Math.abs(clampedY) * (MAX_STRETCH / 2);
            target.scaleY = 1 + Math.abs(clampedY) * MAX_STRETCH - Math.abs(clampedX) * (MAX_STRETCH / 2);
            
            target.textX = clampedX * MAX_TEXT_TRANSLATE;
            target.textY = clampedY * MAX_TEXT_TRANSLATE;
            
            const x = e.clientX - r.left;
            const y = e.clientY - r.top;
            // FIX: `inner` is now correctly typed as HTMLElement, so `style` is accessible.
            inner.style.setProperty('--mx', (x / r.width) * 100 + '%');
            inner.style.setProperty('--my', (y / r.height) * 100 + '%');
        }

        function onEnter() {
            if (prefersReducedMotion) return;
            if (!rafId) {
                rafId = requestAnimationFrame(animate);
            }
            target.textScale = MIN_TEXT_SCALE;
        }

        function onLeave() {
            if (prefersReducedMotion || isPressed) return;
            target.x = 0;
            target.y = 0;
            target.scaleX = 1;
            target.scaleY = 1;
            target.textX = 0;
            target.textY = 0;
            target.textScale = 1;
        }

        function onDown() {
            if (prefersReducedMotion || inner.classList.contains('releasing')) return;
            isPressed = true;
            
            target.x = current.x;
            target.y = current.y;
            target.scaleX = current.scaleX;
            target.scaleY = current.scaleY;
            
            const bounceTx = current.x * (1 - 0.93);
            const bounceTy = current.y * (1 - 0.93);
            // FIX: `inner` is now correctly typed as HTMLElement, so `style` is accessible.
            inner.style.setProperty('--bounce-tx', `${-bounceTx}px`);
            inner.style.setProperty('--bounce-ty', `${-bounceTy}px`);
            
            inner.classList.add('pressed');
        }

        function onUp() {
            if (prefersReducedMotion || !isPressed) return;
            isPressed = false;
            
            inner.classList.remove('pressed');
            
            const overshootTx = current.x * (1 - 1.03);
            const overshootTy = current.y * (1 - 1.03);
            // FIX: `inner` is now correctly typed as HTMLElement, so `style` is accessible.
            inner.style.setProperty('--overshoot-tx', `${-overshootTx}px`);
            inner.style.setProperty('--overshoot-ty', `${-overshootTy}px`);
            
            inner.classList.add('releasing');

            onLeave();
        }

        function onAnimationEnd() {
            if (inner.classList.contains('releasing')) {
                inner.classList.remove('releasing');
                // FIX: `inner` is now correctly typed as HTMLElement, so `style` is accessible.
                inner.style.removeProperty('--bounce-tx');
                inner.style.removeProperty('--bounce-ty');
                inner.style.removeProperty('--overshoot-tx');
                inner.style.removeProperty('--overshoot-ty');
            }
        }

        btn.addEventListener('mouseenter', onEnter);
        btn.addEventListener('mousemove', onMove, { passive: true });
        btn.addEventListener('mouseleave', onLeave);
        btn.addEventListener('mousedown', onDown);
        window.addEventListener('mouseup', onUp);
        inner.addEventListener('animationend', onAnimationEnd);
        
    })();
});