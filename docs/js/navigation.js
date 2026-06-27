/**
   * SPA Navigation Module
   * Controls page transitions, hiding/showing sections, highlighting sidebar tabs.
   */

  export function initNavigation() {
    const sidebarButtons = document.querySelectorAll('.sidebar-item-btn');
    
    sidebarButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        if (target) {
          navigateTo(target);
        }
      });
    });
  }

  export function navigateTo(targetViewModuleId) {
    // 1. Hide all modules
    document.querySelectorAll('.app-view-module').forEach(view => {
      view.classList.remove('active');
    });

    // 2. Remove active state from all sidebar buttons
    document.querySelectorAll('.sidebar-item-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    // 3. Display target module
    const targetView = document.getElementById(`view-${targetViewModuleId}`);
    if (targetView) {
      targetView.classList.add('active');
    }

    // 4. Highlight current sidebar button
    const activeBtn = document.querySelector(`.sidebar-item-btn[data-target="${targetViewModuleId}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }

    // 5. Scroll main panel container back to top to preserve view structure
    const appMain = document.querySelector('.app-main');
    if (appMain) {
      appMain.scrollTop = 0;
    }

    // 6. Handle custom tab hydrations when navigating
    if (targetViewModuleId === 'history' && typeof window.hydrateHistoryTab === 'function') {
      window.hydrateHistoryTab();
    }
  }
