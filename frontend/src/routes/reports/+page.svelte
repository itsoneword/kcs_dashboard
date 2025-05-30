<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { authStore } from '$lib/stores/auth';
  import apiService from '$lib/api';
  import type { User, EvaluationStats, ReportFilters, Engineer } from '$lib/types';
  import {
    Chart,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    LineController,
    Title,
    Tooltip,
    Legend,
    Filler,
  } from 'chart.js';

  // Register Chart.js components
  Chart.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    LineController,
    Title,
    Tooltip,
    Legend,
    Filler
  );

  let user: User | null = null;
  let isLoading = true;
  let stats: EvaluationStats | null = null;
  let quarterlyStats: Record<string, EvaluationStats> | null = null;
  let engineers: Engineer[] = [];
  let selectedFilters: ReportFilters = {
    year: new Date().getFullYear()
  };
  
  let linkRateExpectation = 35;
  let reportGenerated = false;
  let quarterlyChart: Chart | null = null;
  
  // Engineer search functionality
  let engineerSearchTerm = '';
  let filteredEngineers: Engineer[] = [];
  let showEngineerDropdown = false;
  let selectedEngineerIds: number[] = [];
  let displayText = 'All Engineers';
  let myTeamEngineers: Engineer[] = [];
  let myWorkersEngineers: Engineer[] = [];
  
  // Individual stats for selected engineers
  let individualStats: Record<number, EvaluationStats> = {};
  let monthlyData: Record<number, Array<{month: string, stats: EvaluationStats}>> = {};

  onMount(() => {
    addPrintListeners();
    const unsubscribe = authStore.subscribe((auth) => {
      if (!auth.isAuthenticated && !auth.isLoading) {
        goto('/login');
      } else if (auth.isAuthenticated) {
        user = auth.user;
        if (!user?.is_coach && !user?.is_lead && !user?.is_admin) {
          goto('/dashboard');
        } else {
          // Parse URL parameters on mount
          parseUrlParameters();
          loadInitialData();
        }
      }
    });
    return unsubscribe;
  });

  // Parse URL parameters for direct links
  function parseUrlParameters() {
    const params = new URLSearchParams($page.url.search);
    
    // Parse engineer IDs
    const engineerIds = params.getAll('engineer_ids').map(id => parseInt(id)).filter(id => !isNaN(id));
    if (engineerIds.length > 0) {
      selectedEngineerIds = engineerIds;
    }
    
    // Parse single engineer ID
    const engineerId = params.get('engineer_id');
    if (engineerId && !isNaN(parseInt(engineerId))) {
      selectedEngineerIds = [parseInt(engineerId)];
    }
    
    // Parse other filters
    const year = params.get('year');
    if (year && !isNaN(parseInt(year))) {
      selectedFilters.year = parseInt(year);
    }
    
    const quarter = params.get('quarter');
    if (quarter && ['Q1', 'Q2', 'Q3', 'Q4'].includes(quarter)) {
      selectedFilters.quarter = quarter;
    }
    
    // Parse link rate expectation
    const linkRateExp = params.get('link_rate_expectation');
    if (linkRateExp && !isNaN(parseInt(linkRateExp))) {
      linkRateExpectation = parseInt(linkRateExp);
    }
    
    // Auto-generate report if URL has parameters
    if (params.toString()) {
      setTimeout(() => {
        displayText = getSelectedEngineersDisplay();
        loadData();
      }, 500); // Small delay to ensure engineers are loaded first
    }
  }

  // Generate cache key for monthly data
  function generateCacheKey(engineerIds: number[], year: number, quarter?: string): string {
    const sortedIds = [...engineerIds].sort();
    const quarterStr = quarter || 'all';
    return `monthly_${sortedIds.join('_')}_${year}_${quarterStr}`;
  }

  async function loadInitialData() {
    try {
      isLoading = true;
      await Promise.all([loadEngineers(), loadQuickFilterEngineers()]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      isLoading = false;
    }
  }

  async function loadData() {
    try {
      isLoading = true;
      
      const [statsResponse, quarterlyResponse] = await Promise.all([
        apiService.getEvaluationStats(selectedFilters),
        apiService.getQuarterlyStats(selectedFilters.year || new Date().getFullYear())
      ]);

      stats = statsResponse.stats;
      quarterlyStats = quarterlyResponse.quarterly_stats;
      
      await loadIndividualStats();
      reportGenerated = true;
      
      setTimeout(() => {
        createQuarterlyChart();
        createMonthlyCharts();
        if (selectedFilters.quarter) {
          createQuarterMonthlyChart();
        }
      }, 100);
    } catch (error) {
      console.error('Error loading reports:', error);
      
      // Log more details about the error
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
        console.error('Error response headers:', error.response.headers);
      }
      
      // Show user-friendly error message
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load reports';
      console.error('User-friendly error:', errorMessage);
    } finally {
      isLoading = false;
    }
  }

  async function loadEngineers() {
    try {
      const response = await apiService.getEngineersForReports();
      engineers = response.engineers;
      filteredEngineers = engineers;
    } catch (error) {
      console.error('Error loading engineers:', error);
    }
  }

  async function loadQuickFilterEngineers() {
    try {
      if (user?.is_lead) {
        const response = await apiService.getEngineersByLead(user.id);
        myTeamEngineers = response.engineers;
      }
      if (user?.is_coach) {
        const response = await apiService.getEngineersByCoach(user.id);
        myWorkersEngineers = response.engineers;
      }
    } catch (error) {
      console.error('Error loading quick filter engineers:', error);
    }
  }

  async function loadIndividualStats() {
    try {
      const selectedEngineers = getSelectedEngineers();
      const engineersToLoad = selectedEngineers.length > 15 ? selectedEngineers.slice(0, 15) : selectedEngineers;
      
      // Check cache for individual stats
      const cacheKey = `individual_${engineersToLoad.map(e => e.id).sort().join('_')}_${selectedFilters.year || new Date().getFullYear()}_${selectedFilters.quarter || 'all'}`;
      const cachedStats = apiService.getCachedReportData(cacheKey);
      
      if (cachedStats) {
        console.log('Using cached individual stats');
        individualStats = cachedStats;
        // Still load monthly data since it might not be cached
        await loadMonthlyData();
        return;
      }
      
      console.log('Loading fresh individual stats');
      individualStats = {};
      
      // Process engineers sequentially to avoid overwhelming the server
      for (const engineer of engineersToLoad) {
        const engineerFilters = { ...selectedFilters, engineer_id: engineer.id, engineer_ids: undefined };
        try {
          const response = await apiService.getEvaluationStats(engineerFilters);
          individualStats[engineer.id] = response.stats;
          
          // Add a small delay between requests to avoid rate limiting
          if (engineersToLoad.indexOf(engineer) < engineersToLoad.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay
          }
        } catch (error) {
          console.error(`Error loading stats for engineer ${engineer.id}:`, error);
        }
      }

      // Cache the individual stats
      apiService.setCachedReportData(cacheKey, individualStats);

      // Load monthly data for engineers
      await loadMonthlyData();
    } catch (error) {
      console.error('Error loading individual stats:', error);
    }
  }

  async function loadMonthlyData() {
    try {
      const selectedEngineers = getSelectedEngineers();
      const engineersToLoad = selectedEngineers.length > 15 ? selectedEngineers.slice(0, 15) : selectedEngineers;
      const engineerIds = engineersToLoad.map(e => e.id);
      
      // Check cache first
      const cacheKey = generateCacheKey(engineerIds, selectedFilters.year || new Date().getFullYear(), selectedFilters.quarter);
      const cachedData = apiService.getCachedReportData(cacheKey);
      
      if (cachedData) {
        console.log('Using cached monthly data');
        monthlyData = cachedData;
        return;
      }
      
      console.log('Loading fresh monthly data');
      monthlyData = {};
      
      // Determine which months to load based on selected quarter
      let monthsToLoad = [];
      if (selectedFilters.quarter) {
        switch (selectedFilters.quarter) {
          case 'Q1': monthsToLoad = [1, 2, 3]; break;
          case 'Q2': monthsToLoad = [4, 5, 6]; break;
          case 'Q3': monthsToLoad = [7, 8, 9]; break;
          case 'Q4': monthsToLoad = [10, 11, 12]; break;
        }
      } else {
        monthsToLoad = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      }
      
      // Process engineers sequentially to avoid overwhelming the server
      for (const engineer of engineersToLoad) {
        const monthlyStats = [];
        
        // Process months in smaller batches to be even more conservative
        const monthBatches = [];
        for (let i = 0; i < monthsToLoad.length; i += 2) { // Reduced to batches of 2
          monthBatches.push(monthsToLoad.slice(i, i + 2));
        }
        
        for (const monthBatch of monthBatches) {
          // Process a batch of months concurrently
          const batchPromises = monthBatch.map(async (month) => {
            const startDate = new Date(selectedFilters.year || new Date().getFullYear(), month - 1, 1);
            const endDate = new Date(selectedFilters.year || new Date().getFullYear(), month, 0);
            
            const monthFilters = {
              engineer_id: engineer.id,
              start_date: startDate.toISOString().split('T')[0],
              end_date: endDate.toISOString().split('T')[0]
            };
            
            try {
              const response = await apiService.getEvaluationStats(monthFilters);
              return {
                month: new Date(0, month - 1).toLocaleString('default', { month: 'short' }),
                stats: response.stats
              };
            } catch (error) {
              console.error(`Error loading monthly data for engineer ${engineer.id}, month ${month}:`, error);
              // Return empty stats for failed requests
              return {
                month: new Date(0, month - 1).toLocaleString('default', { month: 'short' }),
                stats: {
                  total_evaluations: 0,
                  total_cases: 0,
                  evaluated_cases: 0,
                  article_linked_count: 0,
                  article_linked_percentage: 0,
                  relevant_link_count: 0,
                  relevant_link_percentage: 0,
                  article_improved_count: 0,
                  article_improved_percentage: 0,
                  article_created_count: 0,
                  article_created_percentage: 0,
                  kb_potential_count: 0,
                  kb_potential_percentage: 0,
                  improvement_opportunity_count: 0,
                  improvement_opportunity_percentage: 0,
                  create_opportunity_count: 0,
                  create_opportunity_percentage: 0
                }
              };
            }
          });
          
          const batchResults = await Promise.all(batchPromises);
          monthlyStats.push(...batchResults);
          
          // Increased delay between batches to reduce rate limiting
          if (monthBatches.indexOf(monthBatch) < monthBatches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Increased to 500ms delay
          }
        }
        
        monthlyData[engineer.id] = monthlyStats;
        
        // Increased delay between engineers to further reduce server load
        if (engineersToLoad.indexOf(engineer) < engineersToLoad.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 800)); // Increased to 800ms delay between engineers
        }
      }
      
      // Cache the results
      apiService.setCachedReportData(cacheKey, monthlyData);
    } catch (error) {
      console.error('Error loading monthly data:', error);
    }
  }

  function filterEngineers(searchTerm: string) {
    filteredEngineers = searchTerm ? engineers.filter(engineer => 
      engineer.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) : engineers;
  }

  function selectEngineer(engineer: Engineer | null) {
    if (engineer) {
      const index = selectedEngineerIds.indexOf(engineer.id);
      if (index > -1) {
        selectedEngineerIds = selectedEngineerIds.filter(id => id !== engineer.id);
      } else {
        selectedEngineerIds = [...selectedEngineerIds, engineer.id];
      }
    } else {
      selectedEngineerIds = [];
    }
  }

  function getSelectedEngineersDisplay(): string {
    if (selectedEngineerIds.length === 0) return 'All Engineers';
    if (selectedEngineerIds.length === 1) {
      const engineer = engineers.find(e => e.id === selectedEngineerIds[0]);
      return engineer ? engineer.name : 'Unknown Engineer';
    }
    return `${selectedEngineerIds.length} Engineers Selected`;
  }

  function isEngineerSelected(engineerId: number): boolean {
    return selectedEngineerIds.includes(engineerId);
  }

  function getSelectedEngineers(): Engineer[] {
    return selectedEngineerIds.length === 0 ? engineers : engineers.filter(e => selectedEngineerIds.includes(e.id));
  }

  function getSmileState(statsData: EvaluationStats = stats): 'happy' | 'neutral' | 'sad' {
    if (!statsData) return 'neutral';
    const linkRate = statsData.evaluated_cases > 0 ? Math.round((statsData.article_linked_count / statsData.evaluated_cases) * 100) : 0;
    if (linkRate >= linkRateExpectation + 5) return 'happy';
    if (linkRate >= linkRateExpectation - 5) return 'neutral';
    return 'sad';
  }

  function getStatColor(percentage: number): string {
    const expectation = linkRateExpectation;
    if (percentage >= expectation + 10) return 'text-green-600';
    if (percentage >= expectation - 10) return 'text-yellow-600';
    return 'text-red-600';
  }

  function createQuarterlyChart() {
    if (!monthlyData || Object.keys(monthlyData).length === 0) return;
    const canvas = document.getElementById('quarterlyChart') as HTMLCanvasElement;
    if (!canvas) return;

    if (quarterlyChart) quarterlyChart.destroy();

    const calculatedQuarterlyStats = calculateQuarterlyStatsForSelectedEngineers();
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const linkRates = quarters.map(quarter => {
      const qStats = calculatedQuarterlyStats[quarter];
      return qStats?.evaluated_cases > 0 ? Math.round((qStats.article_linked_count / qStats.evaluated_cases) * 100) : 0;
    });
    
    const accuracyRates = quarters.map(quarter => {
      const qStats = calculatedQuarterlyStats[quarter];
      return qStats?.relevant_link_percentage || 0;
    });

    quarterlyChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: quarters,
        datasets: [
          {
            label: 'Link Rate (%)',
            data: linkRates,
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            fill: true
          },
          {
            label: 'Accuracy Rate (%)',
            data: accuracyRates,
            borderColor: 'rgb(16, 185, 129)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: `Quarterly Performance Trends - ${selectedFilters.year} (Selected Engineers)` },
          legend: { position: 'top' }
        },
        scales: {
          y: { beginAtZero: true, max: 100, title: { display: true, text: 'Percentage' } }
        }
      }
    });
  }

  function createMonthlyCharts() {
    const selectedEngineers = getSelectedEngineers().slice(0, 15);
    
    selectedEngineers.forEach((engineer) => {
      if (!individualStats[engineer.id] || !monthlyData[engineer.id]) return;
      
      const canvas = document.getElementById(`monthlyChart_${engineer.id}`) as HTMLCanvasElement;
      if (!canvas) return;

      const engineerMonthlyData = monthlyData[engineer.id];
      const months = engineerMonthlyData.map(data => data.month);
      const linkRates = engineerMonthlyData.map(data => 
        data.stats.evaluated_cases > 0 ? Math.round((data.stats.article_linked_count / data.stats.evaluated_cases) * 100) : 0
      );
      const accuracyRates = engineerMonthlyData.map(data => data.stats.relevant_link_percentage || 0);
      const contribRates = engineerMonthlyData.map(data => 
        Math.round((data.stats.article_improved_percentage || 0) + (data.stats.article_created_percentage || 0))
      );

      new Chart(canvas, {
        type: 'line',
        data: {
          labels: months,
          datasets: [
            {
              label: 'Link Rate (%)',
              data: linkRates,
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderWidth: 2,
              fill: false
            },
            {
              label: 'Accuracy Rate (%)',
              data: accuracyRates,
              borderColor: 'rgb(16, 185, 129)',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderWidth: 2,
              fill: false
            },
            {
              label: 'Contrib Rate (%)',
              data: contribRates,
              borderColor: 'rgb(245, 158, 11)',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              borderWidth: 2,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            title: { display: true, text: `${engineer.name} - Monthly Performance Trends ${selectedFilters.year}` },
            legend: { position: 'top' }
          },
          scales: {
            y: { beginAtZero: true, max: 100, title: { display: true, text: 'Percentage' } }
          }
        }
      });
    });
  }

  function createQuarterMonthlyChart() {
    if (!selectedFilters.quarter) return;
    
    const canvas = document.getElementById('quarterMonthlyChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Aggregate monthly data for all selected engineers
    const selectedEngineers = getSelectedEngineers();
    let aggregatedMonthlyData = [];
    
    // Determine months for the quarter
    let monthsInQuarter = [];
    switch (selectedFilters.quarter) {
      case 'Q1': monthsInQuarter = ['Jan', 'Feb', 'Mar']; break;
      case 'Q2': monthsInQuarter = ['Apr', 'May', 'Jun']; break;
      case 'Q3': monthsInQuarter = ['Jul', 'Aug', 'Sep']; break;
      case 'Q4': monthsInQuarter = ['Oct', 'Nov', 'Dec']; break;
    }

    // For each month in the quarter, aggregate data from all engineers
    for (const month of monthsInQuarter) {
      let totalEvaluations = 0;
      let totalCases = 0;
      let totalEvaluatedCases = 0;
      let totalLinkedCount = 0;
      let totalRelevantCount = 0;
      let totalImprovedCount = 0;
      let totalCreatedCount = 0;

      selectedEngineers.forEach(engineer => {
        const engineerData = monthlyData[engineer.id];
        if (engineerData) {
          const monthData = engineerData.find(data => data.month === month);
          if (monthData) {
            totalEvaluations += monthData.stats.total_evaluations || 0;
            totalCases += monthData.stats.total_cases || 0;
            totalEvaluatedCases += monthData.stats.evaluated_cases || 0;
            totalLinkedCount += monthData.stats.article_linked_count || 0;
            totalRelevantCount += monthData.stats.relevant_link_count || 0;
            totalImprovedCount += monthData.stats.article_improved_count || 0;
            totalCreatedCount += monthData.stats.article_created_count || 0;
          }
        }
      });

      aggregatedMonthlyData.push({
        month,
        linkRate: totalEvaluatedCases > 0 ? Math.round((totalLinkedCount / totalEvaluatedCases) * 100) : 0,
        accuracyRate: totalLinkedCount > 0 ? Math.round((totalRelevantCount / totalLinkedCount) * 100) : 0,
        contribRate: totalCases > 0 ? Math.round(((totalImprovedCount + totalCreatedCount) / totalCases) * 100) : 0
      });
    }

    new Chart(canvas, {
      type: 'line',
      data: {
        labels: aggregatedMonthlyData.map(data => data.month),
        datasets: [
          {
            label: 'Team Link Rate (%)',
            data: aggregatedMonthlyData.map(data => data.linkRate),
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            fill: true
          },
          {
            label: 'Team Accuracy Rate (%)',
            data: aggregatedMonthlyData.map(data => data.accuracyRate),
            borderColor: 'rgb(16, 185, 129)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            fill: true
          },
          {
            label: 'Team Contrib Rate (%)',
            data: aggregatedMonthlyData.map(data => data.contribRate),
            borderColor: 'rgb(245, 158, 11)',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 2,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: `Team Performance - ${selectedFilters.quarter} ${selectedFilters.year}` },
          legend: { position: 'top' }
        },
        scales: {
          y: { beginAtZero: true, max: 100, title: { display: true, text: 'Percentage' } }
        }
      }
    });
  }

  // Update filters when engineer selection changes
  $: {
    if (selectedEngineerIds.length === 1) {
      selectedFilters.engineer_id = selectedEngineerIds[0];
      selectedFilters.engineer_ids = undefined;
    } else if (selectedEngineerIds.length > 1) {
      selectedFilters.engineer_id = undefined;
      selectedFilters.engineer_ids = selectedEngineerIds;
    } else {
      selectedFilters.engineer_id = undefined;
      selectedFilters.engineer_ids = undefined;
    }
  }

  async function applyFilters() {
    displayText = getSelectedEngineersDisplay();
    await loadData();
  }

  function selectMyTeam() {
    if (user?.is_lead && myTeamEngineers.length > 0) {
      selectedEngineerIds = myTeamEngineers.map(e => e.id);
      displayText = getSelectedEngineersDisplay();
    }
  }

  function selectMyWorkers() {
    if (user?.is_coach && myWorkersEngineers.length > 0) {
      selectedEngineerIds = myWorkersEngineers.map(e => e.id);
      displayText = getSelectedEngineersDisplay();
    }
  }

  async function handleLogout() {
    await authStore.logout();
    goto('/login');
  }

  function handlePrint() {
    // Ensure charts are properly rendered before printing
    setTimeout(() => {
      window.print();
    }, 500);
  }

  // Add print event listeners for better chart handling
  function addPrintListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeprint', () => {
        // Force chart redraw before printing
        if (quarterlyChart) {
          quarterlyChart.resize();
        }
        
        // Redraw individual charts
        const selectedEngineers = getSelectedEngineers().slice(0, 15);
        selectedEngineers.forEach((engineer) => {
          const canvas = document.getElementById(`monthlyChart_${engineer.id}`) as HTMLCanvasElement;
          if (canvas) {
            const chart = Chart.getChart(canvas);
            if (chart) {
              chart.resize();
            }
          }
        });
      });
    }
  }

  // Calculate quarterly stats for selected engineers
  function calculateQuarterlyStatsForSelectedEngineers(): Record<string, EvaluationStats> {
    if (!monthlyData || Object.keys(monthlyData).length === 0) {
      return {};
    }

    const quarterlyStats: Record<string, EvaluationStats> = {};
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    
    quarters.forEach(quarter => {
      let monthsInQuarter = [];
      switch (quarter) {
        case 'Q1': monthsInQuarter = ['Jan', 'Feb', 'Mar']; break;
        case 'Q2': monthsInQuarter = ['Apr', 'May', 'Jun']; break;
        case 'Q3': monthsInQuarter = ['Jul', 'Aug', 'Sep']; break;
        case 'Q4': monthsInQuarter = ['Oct', 'Nov', 'Dec']; break;
      }

      let totalEvaluations = 0;
      let totalCases = 0;
      let evaluatedCases = 0;
      let articleLinkedCount = 0;
      let relevantLinkCount = 0;
      let articleImprovedCount = 0;
      let articleCreatedCount = 0;
      let kbPotentialCount = 0;
      let improvementOpportunityCount = 0;
      let createOpportunityCount = 0;

      // Aggregate data from all selected engineers for this quarter
      getSelectedEngineers().forEach(engineer => {
        const engineerMonthlyData = monthlyData[engineer.id] || [];
        
        monthsInQuarter.forEach(month => {
          const monthData = engineerMonthlyData.find(d => d.month === month);
          if (monthData) {
            totalEvaluations += monthData.stats.total_evaluations || 0;
            totalCases += monthData.stats.total_cases || 0;
            evaluatedCases += monthData.stats.evaluated_cases || 0;
            articleLinkedCount += monthData.stats.article_linked_count || 0;
            relevantLinkCount += monthData.stats.relevant_link_count || 0;
            articleImprovedCount += monthData.stats.article_improved_count || 0;
            articleCreatedCount += monthData.stats.article_created_count || 0;
            kbPotentialCount += monthData.stats.kb_potential_count || 0;
            improvementOpportunityCount += monthData.stats.improvement_opportunity_count || 0;
            createOpportunityCount += monthData.stats.create_opportunity_count || 0;
          }
        });
      });

      quarterlyStats[quarter] = {
        total_evaluations: totalEvaluations,
        total_cases: totalCases,
        evaluated_cases: evaluatedCases,
        article_linked_count: articleLinkedCount,
        article_linked_percentage: totalCases > 0 ? Math.round((articleLinkedCount / totalCases) * 100) : 0,
        relevant_link_count: relevantLinkCount,
        relevant_link_percentage: articleLinkedCount > 0 ? Math.round((relevantLinkCount / articleLinkedCount) * 100) : 0,
        article_improved_count: articleImprovedCount,
        article_improved_percentage: totalCases > 0 ? Math.round((articleImprovedCount / totalCases) * 100) : 0,
        article_created_count: articleCreatedCount,
        article_created_percentage: totalCases > 0 ? Math.round((articleCreatedCount / totalCases) * 100) : 0,
        kb_potential_count: kbPotentialCount,
        kb_potential_percentage: totalCases > 0 ? Math.round((kbPotentialCount / totalCases) * 100) : 0,
        improvement_opportunity_count: improvementOpportunityCount,
        improvement_opportunity_percentage: totalCases > 0 ? Math.round((improvementOpportunityCount / totalCases) * 100) : 0,
        create_opportunity_count: createOpportunityCount,
        create_opportunity_percentage: totalCases > 0 ? Math.round((createOpportunityCount / totalCases) * 100) : 0
      };
    });

    return quarterlyStats;
  }

  // Navigate to evaluations with filters
  function viewQuarterEvaluations(quarter: string) {
    const quarterMonths: Record<string, number[]> = {
      'Q1': [1, 2, 3],
      'Q2': [4, 5, 6], 
      'Q3': [7, 8, 9],
      'Q4': [10, 11, 12]
    };
    
    const months = quarterMonths[quarter];
    const engineerIds = getSelectedEngineers().map(e => e.id);
    
    // Build query parameters for the evaluations page
    const params = new URLSearchParams();
    params.append('year', (selectedFilters.year || new Date().getFullYear()).toString());
    if (engineerIds.length > 0) {
      engineerIds.forEach(id => params.append('engineer_ids', id.toString()));
    }
    months.forEach(month => params.append('months', month.toString()));
    
    goto(`/evaluations?${params.toString()}`);
  }

  // Navigate to evaluations with filters for monthly data
  function viewMonthEvaluations(engineerId: number, month: string, year: number) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNumber = monthNames.indexOf(month) + 1;
    
    if (monthNumber === 0) return; // Invalid month
    
    // Build query parameters for the evaluations page
    const params = new URLSearchParams();
    params.append('year', year.toString());
    params.append('month', monthNumber.toString());
    params.append('engineer_id', engineerId.toString());
    
    goto(`/evaluations?${params.toString()}`);
  }

  // Generate shareable URL for current report
  function generateShareableUrl(): string {
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    
    // Add engineer IDs
    selectedEngineerIds.forEach(id => params.append('engineer_ids', id.toString()));
    
    // Add other filters
    if (selectedFilters.year) params.append('year', selectedFilters.year.toString());
    if (selectedFilters.quarter) params.append('quarter', selectedFilters.quarter);
    if (linkRateExpectation !== 35) params.append('link_rate_expectation', linkRateExpectation.toString());
    
    return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
  }
  
  async function copyShareableUrl() {
    try {
      const url = generateShareableUrl();
      await navigator.clipboard.writeText(url);
      console.log('URL copied to clipboard:', url);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy URL:', err);
      // Fallback: show the URL in an alert
      alert(`Copy this URL: ${generateShareableUrl()}`);
    }
  }

  // Clear cache function for manual cache clearing
  function clearReportCache() {
    apiService.clearReportCache();
    console.log('Report cache cleared');
    // You could add a toast notification here
  }

  // Performance analysis and cache status
  function getPerformanceAnalysis() {
    const selectedEngineers = getSelectedEngineers();
    const monthsToLoad = selectedFilters.quarter ? 3 : 12;
    
    return {
      estimatedRequests: selectedEngineers.length * monthsToLoad + selectedEngineers.length + 2, // monthly + individual + quarterly + general
      estimatedTimeWithoutCache: Math.ceil((selectedEngineers.length * monthsToLoad * 0.8) + (selectedEngineers.length * 0.3)) + ' seconds',
      estimatedTimeWithCache: '1-3 seconds',
      cacheKeys: getCacheKeys()
    };
  }
  
  function getCacheKeys(): string[] {
    if (!browser) return [];
    return Object.keys(localStorage).filter(key => key.startsWith('report_cache_'));
  }
  
  function getCacheStatus(): { cached: boolean; keys: string[] } {
    const selectedEngineers = getSelectedEngineers();
    const engineerIds = selectedEngineers.map(e => e.id);
    
    const monthlyCacheKey = generateCacheKey(engineerIds, selectedFilters.year || new Date().getFullYear(), selectedFilters.quarter);
    const individualCacheKey = `individual_${engineerIds.sort().join('_')}_${selectedFilters.year || new Date().getFullYear()}_${selectedFilters.quarter || 'all'}`;
    
    const monthlyData = apiService.getCachedReportData(monthlyCacheKey);
    const individualData = apiService.getCachedReportData(individualCacheKey);
    
    return {
      cached: !!monthlyData && !!individualData,
      keys: [monthlyCacheKey, individualCacheKey]
    };
  }
</script>

<svelte:head>
  <title>Reports - KCS Portal</title>
  <meta name="color-scheme" content="light" />
  <style>
    @media print {
      /* Hide navigation and filters */
      .no-print { display: none !important; }
      
      /* Print-specific page setup */
      @page {
        size: A4;
        margin: 0.5in;
      }
      
      /* Body and main containers */
      body {
        -webkit-print-color-adjust: exact !important;
        color-adjust: exact !important;
        print-color-adjust: exact !important;
        width: 210mm !important; /* A4 width */
        max-width: 210mm !important;
      }
      
      /* Main container fixes */
      .min-h-screen {
        min-height: auto !important;
      }
      
      .max-w-7xl {
        max-width: 100% !important;
        width: 100% !important;
      }
      
      /* Report sections */
      .report-section {
        page-break-after: always;
        margin-bottom: 1rem;
        padding-bottom: 1rem;
        width: 100% !important;
        max-width: 100% !important;
      }
      .report-section:last-child {
        page-break-after: auto;
      }
      
      /* Cards and containers */
      .card {
        background: white !important;
        border: 1px solid #e5e7eb !important;
        border-radius: 0.375rem !important;
        box-shadow: none !important;
        margin-bottom: 1rem !important;
        page-break-inside: avoid;
        width: 100% !important;
        max-width: 100% !important;
      }
      
      /* Grid layouts - FORCE SPECIFIC LAYOUTS */
      .grid {
        display: grid !important;
        width: 100% !important;
      }
      
      /* Force 5-column grid for stats cards */
      .grid-cols-5 { 
        grid-template-columns: 1fr 1fr 1fr 1fr 1fr !important;
        min-width: 100% !important;
        width: 100% !important;
      }
      
      /* Force 2-column grid for detailed metrics */
      .grid-cols-2 { 
        grid-template-columns: 1fr 1fr !important;
        min-width: 100% !important;
        width: 100% !important;
      }
      
      /* Single column for smaller screens/sections */
      .grid-cols-1 { 
        grid-template-columns: 1fr !important;
        width: 100% !important;
      }
      
      /* Grid gaps */
      .gap-4 { gap: 0.5rem !important; }
      .gap-8 { gap: 1rem !important; }
      
      /* Force grid items to stay in bounds */
      .grid > * {
        min-width: 0 !important;
        width: 100% !important;
        overflow: hidden !important;
      }
      
      /* Specific fixes for stats cards */
      .grid-cols-5 > .card {
        width: 100% !important;
        min-width: 0 !important;
        flex: none !important;
      }
      
      /* Typography and colors */
      .text-primary-600 { color: #2563eb !important; }
      .text-blue-600 { color: #2563eb !important; }
      .text-green-600 { color: #16a34a !important; }
      .text-yellow-600 { color: #ca8a04 !important; }
      .text-red-600 { color: #dc2626 !important; }
      .text-purple-600 { color: #9333ea !important; }
      .text-gray-900 { color: #111827 !important; }
      .text-gray-700 { color: #374151 !important; }
      .text-gray-600 { color: #4b5563 !important; }
      .text-gray-500 { color: #6b7280 !important; }
      
      /* Font sizes and weights */
      .text-2xl { font-size: 1.2rem !important; line-height: 1.4rem !important; }
      .text-lg { font-size: 1rem !important; line-height: 1.5rem !important; }
      .text-sm { font-size: 0.8rem !important; line-height: 1.1rem !important; }
      .text-xs { font-size: 0.7rem !important; line-height: 1rem !important; }
      .font-bold { font-weight: 700 !important; }
      .font-medium { font-weight: 500 !important; }
      
      /* Background colors for cards and sections */
      .bg-gray-50 {
        background-color: #f9fafb !important;
        -webkit-print-color-adjust: exact;
      }
      .bg-white {
        background-color: white !important;
        -webkit-print-color-adjust: exact;
      }
      
      /* Progress bars */
      .bg-gray-200 {
        background-color: #e5e7eb !important;
        -webkit-print-color-adjust: exact;
      }
      .bg-green-600 {
        background-color: #16a34a !important;
        -webkit-print-color-adjust: exact;
      }
      .bg-blue-600 {
        background-color: #2563eb !important;
        -webkit-print-color-adjust: exact;
      }
      .bg-indigo-600 {
        background-color: #4f46e5 !important;
        -webkit-print-color-adjust: exact;
      }
      .bg-yellow-600 {
        background-color: #ca8a04 !important;
        -webkit-print-color-adjust: exact;
      }
      .bg-purple-600 {
        background-color: #9333ea !important;
        -webkit-print-color-adjust: exact;
      }
      .bg-orange-600 {
        background-color: #ea580c !important;
        -webkit-print-color-adjust: exact;
      }
      .bg-red-600 {
        background-color: #dc2626 !important;
        -webkit-print-color-adjust: exact;
      }
      
      /* Rounded corners */
      .rounded-full { border-radius: 9999px !important; }
      .rounded-lg { border-radius: 0.375rem !important; }
      
      /* Height and width */
      .h-2 { height: 0.4rem !important; }
      .w-full { width: 100% !important; }
      
      /* Spacing - reduced for print */
      .p-4 { padding: 0.75rem !important; }
      .p-6 { padding: 1rem !important; }
      .px-6 { padding-left: 1rem !important; padding-right: 1rem !important; }
      .py-4 { padding-top: 0.75rem !important; padding-bottom: 0.75rem !important; }
      .py-3 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
      .mb-4 { margin-bottom: 0.75rem !important; }
      .mb-6 { margin-bottom: 1rem !important; }
      .mb-8 { margin-bottom: 1.5rem !important; }
      
      /* Tables */
      table {
        border-collapse: collapse !important;
        width: 100% !important;
        font-size: 0.8rem !important;
      }
      
      th, td {
        border: 1px solid #e5e7eb !important;
        padding: 0.4rem !important;
        text-align: left !important;
      }
      
      th {
        background-color: #f9fafb !important;
        -webkit-print-color-adjust: exact;
        font-weight: 600 !important;
      }
      
      .border-b { border-bottom: 1px solid #e5e7eb !important; }
      .border-gray-200 { border-color: #e5e7eb !important; }
      .border-gray-300 { border-color: #d1d5db !important; }
      
      /* Hover states (remove for print) */
      .hover\:bg-gray-50:hover,
      .hover\:bg-gray-100:hover {
        background-color: transparent !important;
      }
      
      /* Charts - ensure they print */
      canvas {
        max-width: 100% !important;
        height: auto !important;
        max-height: 300px !important;
        page-break-inside: avoid;
      }
      
      /* Emoji sizing */
      .text-6xl {
        font-size: 2.5rem !important;
        line-height: 1 !important;
      }
      
      /* Flex layouts */
      .flex {
        display: flex !important;
      }
      .items-center {
        align-items: center !important;
      }
      .justify-between {
        justify-content: space-between !important;
      }
      .space-x-2 > * + * {
        margin-left: 0.4rem !important;
      }
      .space-y-4 > * + * {
        margin-top: 0.75rem !important;
      }
      
      /* Overflow handling */
      .overflow-x-auto {
        overflow-x: visible !important;
      }
      
      /* Ensure minimum contrast */
      .text-white {
        color: #000000 !important;
      }
      
      /* Page break controls */
      .page-break-inside-avoid {
        page-break-inside: avoid;
      }
      
      /* Chart containers */
      #quarterlyChart,
      #quarterMonthlyChart,
      canvas[id^="monthlyChart_"] {
        page-break-inside: avoid;
        max-height: 300px !important;
        width: 100% !important;
      }
      
      /* Responsive prevention for print */
      @media (max-width: 99999px) {
        .grid-cols-5 { 
          grid-template-columns: 1fr 1fr 1fr 1fr 1fr !important;
        }
        .grid-cols-2 { 
          grid-template-columns: 1fr 1fr !important;
        }
      }
      
      /* Force container widths */
      .container, .max-w-7xl, .mx-auto {
        max-width: 100% !important;
        width: 100% !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      
      /* Print-specific grid overrides */
      .print-stats-grid {
        display: grid !important;
        grid-template-columns: 1fr 1fr 1fr 1fr 1fr !important;
        width: 100% !important;
        gap: 0.5rem !important;
      }
      
      .print-metrics-grid {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        width: 100% !important;
        gap: 1rem !important;
      }
      
      /* Ensure all grid items behave */
      .print-stats-grid > *,
      .print-metrics-grid > * {
        min-width: 0 !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }
    }
    
    .report-section {
      margin-bottom: 3rem;
      padding-bottom: 2rem;
    }
  </style>
</svelte:head>

{#if isLoading}
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
      <p class="mt-4 text-gray-600">Loading reports...</p>
    </div>
  </div>
{:else if user}
  <div class="min-h-screen bg-gray-50">
    <!-- Navigation Header -->
    <nav class="bg-white shadow-sm border-b border-gray-200 no-print">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center space-x-4">
            <a href="/dashboard" class="text-primary-600 hover:text-primary-700">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </a>
            <h1 class="text-xl font-semibold text-gray-900">Reports & Analytics</h1>
          </div>
          
          <div class="flex items-center space-x-4">
            <span class="text-sm text-gray-700">Welcome, {user.name}</span>
            {#if user.is_admin}
              <span class="badge badge-admin">Admin</span>
            {:else if user.is_lead}
              <span class="badge badge-lead">Lead</span>
            {:else if user.is_coach}
              <span class="badge badge-coach">Coach</span>
            {/if}
            {#if reportGenerated}
              <button on:click={handlePrint} class="btn-secondary text-sm">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Report
              </button>
              <button on:click={copyShareableUrl} class="btn-secondary text-sm">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Share URL
              </button>
              <button on:click={clearReportCache} class="btn-secondary text-sm" title="Clear cached report data">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Clear Cache
              </button>
            {/if}
            <button on:click={handleLogout} class="btn-secondary text-sm">Logout</button>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        
        <!-- Filters Section -->
        <div class="card p-4 mb-6 no-print">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Report Parameters</h3>
          <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
            <!-- Engineers Filter -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Engineers</label>
              <div class="relative">
                <input 
                  type="text" 
                  placeholder="Search engineers or select all..."
                  class="input w-full"
                  value={showEngineerDropdown ? engineerSearchTerm : displayText}
                  on:input={(e) => {
                    engineerSearchTerm = e.target.value;
                    filterEngineers(engineerSearchTerm);
                    showEngineerDropdown = true;
                  }}
                  on:focus={() => {
                    engineerSearchTerm = '';
                    showEngineerDropdown = true;
                    filterEngineers('');
                  }}
                  on:blur={() => setTimeout(() => showEngineerDropdown = false, 200)}
                />
                
                {#if showEngineerDropdown}
                  <div class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    <button type="button" class="w-full px-3 py-2 text-left hover:bg-gray-100 border-b border-gray-200 flex items-center space-x-2" on:mousedown|preventDefault={() => selectEngineer(null)}>
                      <input type="checkbox" checked={selectedEngineerIds.length === 0} class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" readonly />
                      <span class="font-medium text-gray-900">All Engineers</span>
                    </button>
                    {#each filteredEngineers as engineer}
                      <button type="button" class="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center space-x-2 {isEngineerSelected(engineer.id) ? 'bg-blue-50' : ''}" on:mousedown|preventDefault={() => selectEngineer(engineer)}>
                        <input type="checkbox" checked={isEngineerSelected(engineer.id)} class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" readonly />
                        <span class="{isEngineerSelected(engineer.id) ? 'text-blue-700 font-medium' : 'text-gray-900'}">{engineer.name}</span>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
            
            <!-- Quarter Filter -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Interval (Quarters)</label>
              <select bind:value={selectedFilters.quarter} class="input">
                <option value="">All Quarters</option>
                <option value="Q1">Q1 (Jan-Mar)</option>
                <option value="Q2">Q2 (Apr-Jun)</option>
                <option value="Q3">Q3 (Jul-Sep)</option>
                <option value="Q4">Q4 (Oct-Dec)</option>
              </select>
            </div>
            
            <!-- Year Filter -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <select bind:value={selectedFilters.year} class="input">
                <option value={2025}>2025</option>
                <option value={2024}>2024</option>
                <option value={2023}>2023</option>
              </select>
            </div>
            
            <!-- Link Rate Expectations -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Link Rate Expectations %</label>
              <input type="number" bind:value={linkRateExpectation} min="0" max="100" class="input" placeholder="35" />
            </div>
            
            <!-- Generate Button -->
            <div class="flex items-end">
              <button on:click={applyFilters} disabled={isLoading} class="btn-primary w-full {isLoading ? 'opacity-50 cursor-not-allowed' : ''}">
                {#if isLoading}
                  <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                {:else}
                  Generate Report
                {/if}
              </button>
            </div>
          </div>
          
          <!-- Quick Filter Buttons -->
          {#if user && (user.is_lead || user.is_coach)}
            <div class="mt-4 flex flex-wrap gap-2">
              {#if user.is_lead && myTeamEngineers.length > 0}
                <button on:click={selectMyTeam} class="btn-secondary text-sm">
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  My Team ({myTeamEngineers.length})
                </button>
              {/if}
              
              {#if user.is_coach && myWorkersEngineers.length > 0}
                <button on:click={selectMyWorkers} class="btn-secondary text-sm">
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  My Workers ({myWorkersEngineers.length})
                </button>
              {/if}
            </div>
          {/if}

          <!-- Debug Panel -->
          <details class="mt-4 border-t pt-4">
            <summary class="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
              <span class="font-medium">Performance & Cache Status</span>
              <span class="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {getCacheStatus().cached ? 'Cached' : 'Not Cached'}
              </span>
            </summary>
            <div class="mt-3 space-y-2 text-sm">
              {#if true}
                {@const analysis = getPerformanceAnalysis()}
                {@const cacheStatus = getCacheStatus()}
                
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <p><strong>Selected Engineers:</strong> {getSelectedEngineers().length}</p>
                    <p><strong>Estimated API Requests:</strong> {analysis.estimatedRequests}</p>
                    <p><strong>Time without cache:</strong> {analysis.estimatedTimeWithoutCache}</p>
                    <p><strong>Time with cache:</strong> {analysis.estimatedTimeWithCache}</p>
                  </div>
                  <div>
                    <p><strong>Cache Status:</strong> 
                      <span class="px-2 py-1 rounded text-xs {cacheStatus.cached ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        {cacheStatus.cached ? 'Available' : 'Not Available'}
                      </span>
                    </p>
                    <p><strong>Total Cache Keys:</strong> {getCacheKeys().length}</p>
                    <div class="mt-2">
                      <button on:click={clearReportCache} class="text-red-600 hover:text-red-800 text-xs underline">
                        Clear All Cache
                      </button>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          </details>
        </div>

        <!-- Reports Content -->
        {#if reportGenerated && stats}
          <!-- Team Summary Report -->
          <div class="report-section">
            <div class="flex justify-between items-start mb-6">
              <div class="flex-1">
                <h2 class="text-2xl font-bold text-gray-900 mb-4">PAR for {user?.name}'s team</h2>
                <div class="bg-gray-50 rounded-lg p-4">
                  <h3 class="text-sm font-medium text-gray-700 mb-3">The report is generated for {selectedFilters.quarter || 'All Quarters'} {selectedFilters.year}:</h3>
                  <div class="overflow-x-auto">
                    <table class="min-w-full">
                      <thead>
                        <tr class="border-b border-gray-300">
                          <th class="text-left text-xs font-medium text-gray-600 uppercase tracking-wider py-2">Engineer</th>
                          <th class="text-left text-xs font-medium text-gray-600 uppercase tracking-wider py-2">Lead</th>
                          <th class="text-left text-xs font-medium text-gray-600 uppercase tracking-wider py-2">Coach</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each getSelectedEngineers() as engineer}
                          <tr>
                            <td class="text-sm text-gray-900 py-1">{engineer.name}</td>
                            <td class="text-sm text-gray-600 py-1">{engineer.lead_name || 'No Lead'}</td>
                            <td class="text-sm text-gray-600 py-1">{engineer.coach_name || 'No Coach'}</td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              
              <div class="ml-6 text-center">
                <div class="mb-2">
                  {#if getSmileState() === 'happy'}
                    <div class="text-6xl">😊</div>
                    <div class="text-sm text-green-600 font-medium">Happy</div>
                  {:else if getSmileState() === 'neutral'}
                    <div class="text-6xl">😐</div>
                    <div class="text-sm text-yellow-600 font-medium">Neutral</div>
                  {:else}
                    <div class="text-6xl">😢</div>
                    <div class="text-sm text-red-600 font-medium">Sad</div>
                  {/if}
                </div>
                <div class="text-xs text-gray-500">Smile based on<br/>Link rate vs {linkRateExpectation}% expectation</div>
              </div>
            </div>

            <!-- Overview Stats -->
            <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8 print-stats-grid">
              <div class="card p-4">
                <div class="text-2xl font-bold text-primary-600">{stats.total_evaluations}</div>
                <div class="text-sm text-gray-500">Total Evaluations</div>
              </div>
              <div class="card p-4">
                <div class="text-2xl font-bold text-blue-600">{stats.evaluated_cases > 0 ? Math.round((stats.article_linked_count / stats.evaluated_cases) * 100) : 0}%</div>
                <div class="text-sm text-gray-500">Av Linkrate</div>
              </div>
              <div class="card p-4">
                <div class="text-2xl font-bold {getStatColor(Math.round(stats.article_improved_percentage + stats.article_created_percentage))}">{Math.round(stats.article_improved_percentage + stats.article_created_percentage)}%</div>
                <div class="text-sm text-gray-500">Av Contrib rate</div>
              </div>
              <div class="card p-4">
                <div class="text-2xl font-bold {getStatColor(stats.relevant_link_percentage)}">{stats.relevant_link_percentage}%</div>
                <div class="text-sm text-gray-500">Av accuracy rate</div>
              </div>
              <div class="card p-4">
                <div class="text-2xl font-bold text-purple-600">{selectedFilters.quarter || 'All Quarters'} {selectedFilters.year}</div>
                <div class="text-sm text-gray-500">Interval</div>
              </div>
            </div>

            <!-- Detailed Metrics -->
            <div class="card mb-8">
              <div class="px-6 py-4 border-b border-gray-200">
                <h3 class="text-lg font-medium text-gray-900">Detailed Metrics</h3>
              </div>
              <div class="p-6">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 print-metrics-grid">
                  <!-- Left Column -->
                  <div class="space-y-4">
                    <div class="flex justify-between items-center">
                      <span class="text-sm font-medium text-gray-700">Article Linked</span>
                      <div class="flex items-center space-x-2">
                        <span class="text-sm text-gray-500">{stats.article_linked_count}/{stats.total_cases}</span>
                        <span class="text-sm font-medium {getStatColor(stats.article_linked_percentage)}">{stats.article_linked_percentage}%</span>
                      </div>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                      <div class="bg-green-600 h-2 rounded-full" style="width: {stats.article_linked_percentage}%"></div>
                    </div>

                    <div class="flex justify-between items-center">
                      <span class="text-sm font-medium text-gray-700">KB Potential</span>
                      <div class="flex items-center space-x-2">
                        <span class="text-sm text-gray-500">{stats.kb_potential_count}/{stats.total_cases}</span>
                        <span class="text-sm font-medium {getStatColor(stats.kb_potential_percentage)}">{stats.kb_potential_percentage}%</span>
                      </div>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                      <div class="bg-blue-600 h-2 rounded-full" style="width: {stats.kb_potential_percentage}%"></div>
                    </div>

                    <div class="flex justify-between items-center">
                      <span class="text-sm font-medium text-gray-700">Relevant Link</span>
                      <div class="flex items-center space-x-2">
                        <span class="text-sm text-gray-500">{stats.relevant_link_count}/{stats.article_linked_count}</span>
                        <span class="text-sm font-medium {getStatColor(stats.relevant_link_percentage)}">{stats.relevant_link_percentage}%</span>
                      </div>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                      <div class="bg-indigo-600 h-2 rounded-full" style="width: {stats.relevant_link_percentage}%"></div>
                    </div>
                  </div>

                  <!-- Right Column -->
                  <div class="space-y-4">
                    <div class="flex justify-between items-center">
                      <span class="text-sm font-medium text-gray-700">Article Improved</span>
                      <div class="flex items-center space-x-2">
                        <span class="text-sm text-gray-500">{stats.article_improved_count}/{stats.total_cases}</span>
                        <span class="text-sm font-medium {getStatColor(stats.article_improved_percentage)}">{stats.article_improved_percentage}%</span>
                      </div>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                      <div class="bg-yellow-600 h-2 rounded-full" style="width: {stats.article_improved_percentage}%"></div>
                    </div>

                    <div class="flex justify-between items-center">
                      <span class="text-sm font-medium text-gray-700">Article Created</span>
                      <div class="flex items-center space-x-2">
                        <span class="text-sm text-gray-500">{stats.article_created_count}/{stats.total_cases}</span>
                        <span class="text-sm font-medium {getStatColor(stats.article_created_percentage)}">{stats.article_created_percentage}%</span>
                      </div>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                      <div class="bg-purple-600 h-2 rounded-full" style="width: {stats.article_created_percentage}%"></div>
                    </div>

                    <div class="flex justify-between items-center">
                      <span class="text-sm font-medium text-gray-700">Improvement Opportunity</span>
                      <div class="flex items-center space-x-2">
                        <span class="text-sm text-gray-500">{stats.improvement_opportunity_count}/{stats.total_cases}</span>
                        <span class="text-sm font-medium {getStatColor(stats.improvement_opportunity_percentage)}">{stats.improvement_opportunity_percentage}%</span>
                      </div>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                      <div class="bg-orange-600 h-2 rounded-full" style="width: {stats.improvement_opportunity_percentage}%"></div>
                    </div>

                    <div class="flex justify-between items-center">
                      <span class="text-sm font-medium text-gray-700">Create Opportunity</span>
                      <div class="flex items-center space-x-2">
                        <span class="text-sm text-gray-500">{stats.create_opportunity_count}/{stats.total_cases}</span>
                        <span class="text-sm font-medium {getStatColor(stats.create_opportunity_percentage)}">{stats.create_opportunity_percentage}%</span>
                      </div>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                      <div class="bg-red-600 h-2 rounded-full" style="width: {stats.create_opportunity_percentage}%"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Quarterly Results Table -->
            {#if Object.keys(monthlyData).length > 0}
              {@const calculatedQuarterlyStats = calculateQuarterlyStatsForSelectedEngineers()}
              <div class="card mb-8">
                <div class="px-6 py-4 border-b border-gray-200">
                  <h3 class="text-lg font-medium text-gray-900">Quarterly Breakdown for Selected Engineers</h3>
                  <p class="text-sm text-gray-600 mt-1">Click on evaluation numbers to view detailed evaluations list</p>
                </div>
                <div class="p-6">
                  <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                      <thead class="bg-gray-50">
                        <tr>
                          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quarter</th>
                          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Evaluations</th>
                          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Link Rate</th>
                          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Accuracy Rate</th>
                          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contrib Rate</th>
                        </tr>
                      </thead>
                      <tbody class="bg-white divide-y divide-gray-200">
                        {#each ['Q1', 'Q2', 'Q3', 'Q4'] as quarter}
                          {@const qStats = calculatedQuarterlyStats[quarter]}
                          {@const linkRate = qStats?.evaluated_cases > 0 ? Math.round((qStats.article_linked_count / qStats.evaluated_cases) * 100) : 0}
                          {@const contribRate = Math.round((qStats?.article_improved_percentage || 0) + (qStats?.article_created_percentage || 0))}
                          <tr class="hover:bg-gray-50">
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{quarter} {selectedFilters.year}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {#if qStats?.total_evaluations > 0}
                                <button 
                                  on:click={() => viewQuarterEvaluations(quarter)}
                                  class="text-primary-600 hover:text-primary-800 underline cursor-pointer"
                                  title="Click to view evaluations for {quarter}"
                                >
                                  {qStats.total_evaluations}
                                </button>
                              {:else}
                                0
                              {/if}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span class="{getStatColor(linkRate)}">
                                {linkRate}%
                              </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span class="{getStatColor(qStats?.relevant_link_percentage || 0)}">
                                {qStats?.relevant_link_percentage || 0}%
                              </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span class="{getStatColor(contribRate)}">
                                {contribRate}%
                              </span>
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Quarterly Chart -->
            {#if Object.keys(monthlyData).length > 0 && !selectedFilters.quarter}
              <div class="card mb-8">
                <div class="px-6 py-4 border-b border-gray-200">
                  <h3 class="text-lg font-medium text-gray-900">Quarterly Comparison Chart</h3>
                </div>
                <div class="p-6">
                  <canvas id="quarterlyChart" width="400" height="100"></canvas>
                </div>
              </div>
            {:else if selectedFilters.quarter}
              <!-- Monthly Chart for Selected Quarter -->
              <div class="card mb-8">
                <div class="px-6 py-4 border-b border-gray-200">
                  <h3 class="text-lg font-medium text-gray-900">{selectedFilters.quarter} {selectedFilters.year} Monthly Trends</h3>
                </div>
                <div class="p-6">
                  <canvas id="quarterMonthlyChart" width="400" height="100"></canvas>
                </div>
              </div>
            {/if}
          </div>

          <!-- Individual Engineer Reports -->
          {#each getSelectedEngineers().slice(0, 15) as engineer}
            {#if individualStats[engineer.id]}
              {@const engineerStats = individualStats[engineer.id]}
              <div class="report-section">
                <div class="flex justify-between items-start mb-6">
                  <div class="flex-1">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">PAR for {engineer.name}</h2>
                    <div class="bg-gray-50 rounded-lg p-4">
                      <h3 class="text-sm font-medium text-gray-700 mb-3">The report is generated for {selectedFilters.quarter || 'All Quarters'} {selectedFilters.year}:</h3>
                      <div class="overflow-x-auto">
                        <table class="min-w-full">
                          <thead>
                            <tr class="border-b border-gray-300">
                              <th class="text-left text-xs font-medium text-gray-600 uppercase tracking-wider py-2">Engineer</th>
                              <th class="text-left text-xs font-medium text-gray-600 uppercase tracking-wider py-2">Lead</th>
                              <th class="text-left text-xs font-medium text-gray-600 uppercase tracking-wider py-2">Coach</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td class="text-sm text-gray-900 py-1">{engineer.name}</td>
                              <td class="text-sm text-gray-600 py-1">{engineer.lead_name || 'No Lead'}</td>
                              <td class="text-sm text-gray-600 py-1">{engineer.coach_name || 'No Coach'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  
                  <div class="ml-6 text-center">
                    <div class="mb-2">
                      {#if getSmileState(engineerStats) === 'happy'}
                        <div class="text-6xl">😊</div>
                        <div class="text-sm text-green-600 font-medium">Happy</div>
                      {:else if getSmileState(engineerStats) === 'neutral'}
                        <div class="text-6xl">😐</div>
                        <div class="text-sm text-yellow-600 font-medium">Neutral</div>
                      {:else}
                        <div class="text-6xl">😢</div>
                        <div class="text-sm text-red-600 font-medium">Sad</div>
                      {/if}
                    </div>
                    <div class="text-xs text-gray-500">Smile based on<br/>Link rate vs {linkRateExpectation}% expectation</div>
                  </div>
                </div>

                <!-- Engineer Overview Stats -->
                <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8 print-stats-grid">
                  <div class="card p-4">
                    <div class="text-2xl font-bold text-primary-600">{engineerStats.total_evaluations}</div>
                    <div class="text-sm text-gray-500">Total Evaluations</div>
                  </div>
                  <div class="card p-4">
                    <div class="text-2xl font-bold text-blue-600">{engineerStats.evaluated_cases > 0 ? Math.round((engineerStats.article_linked_count / engineerStats.evaluated_cases) * 100) : 0}%</div>
                    <div class="text-sm text-gray-500">Av Eng Linkrate</div>
                  </div>
                  <div class="card p-4">
                    <div class="text-2xl font-bold {getStatColor(Math.round(engineerStats.article_improved_percentage + engineerStats.article_created_percentage))}">{Math.round(engineerStats.article_improved_percentage + engineerStats.article_created_percentage)}%</div>
                    <div class="text-sm text-gray-500">Av Eng Contrib rate</div>
                  </div>
                  <div class="card p-4">
                    <div class="text-2xl font-bold {getStatColor(engineerStats.relevant_link_percentage)}">{engineerStats.relevant_link_percentage}%</div>
                    <div class="text-sm text-gray-500">Av Eng accuracy rate</div>
                  </div>
                  <div class="card p-4">
                    <div class="text-2xl font-bold text-purple-600">{selectedFilters.quarter || 'All Quarters'} {selectedFilters.year}</div>
                    <div class="text-sm text-gray-500">Interval</div>
                  </div>
                </div>

                <!-- Engineer Detailed Metrics -->
                <div class="card mb-8">
                  <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-medium text-gray-900">Detailed Metrics</h3>
                  </div>
                  <div class="p-6">
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 print-metrics-grid">
                      <!-- Left Column -->
                      <div class="space-y-4">
                        <div class="flex justify-between items-center">
                          <span class="text-sm font-medium text-gray-700">Article Linked</span>
                          <div class="flex items-center space-x-2">
                            <span class="text-sm text-gray-500">{engineerStats.article_linked_count}/{engineerStats.total_cases}</span>
                            <span class="text-sm font-medium {getStatColor(engineerStats.article_linked_percentage)}">{engineerStats.article_linked_percentage}%</span>
                          </div>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                          <div class="bg-green-600 h-2 rounded-full" style="width: {engineerStats.article_linked_percentage}%"></div>
                        </div>

                        <div class="flex justify-between items-center">
                          <span class="text-sm font-medium text-gray-700">KB Potential</span>
                          <div class="flex items-center space-x-2">
                            <span class="text-sm text-gray-500">{engineerStats.kb_potential_count}/{engineerStats.total_cases}</span>
                            <span class="text-sm font-medium {getStatColor(engineerStats.kb_potential_percentage)}">{engineerStats.kb_potential_percentage}%</span>
                          </div>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                          <div class="bg-blue-600 h-2 rounded-full" style="width: {engineerStats.kb_potential_percentage}%"></div>
                        </div>

                        <div class="flex justify-between items-center">
                          <span class="text-sm font-medium text-gray-700">Relevant Link</span>
                          <div class="flex items-center space-x-2">
                            <span class="text-sm text-gray-500">{engineerStats.relevant_link_count}/{engineerStats.article_linked_count}</span>
                            <span class="text-sm font-medium {getStatColor(engineerStats.relevant_link_percentage)}">{engineerStats.relevant_link_percentage}%</span>
                          </div>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                          <div class="bg-indigo-600 h-2 rounded-full" style="width: {engineerStats.relevant_link_percentage}%"></div>
                        </div>
                      </div>

                      <!-- Right Column -->
                      <div class="space-y-4">
                        <div class="flex justify-between items-center">
                          <span class="text-sm font-medium text-gray-700">Article Improved</span>
                          <div class="flex items-center space-x-2">
                            <span class="text-sm text-gray-500">{engineerStats.article_improved_count}/{engineerStats.total_cases}</span>
                            <span class="text-sm font-medium {getStatColor(engineerStats.article_improved_percentage)}">{engineerStats.article_improved_percentage}%</span>
                          </div>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                          <div class="bg-yellow-600 h-2 rounded-full" style="width: {engineerStats.article_improved_percentage}%"></div>
                        </div>

                        <div class="flex justify-between items-center">
                          <span class="text-sm font-medium text-gray-700">Article Created</span>
                          <div class="flex items-center space-x-2">
                            <span class="text-sm text-gray-500">{engineerStats.article_created_count}/{engineerStats.total_cases}</span>
                            <span class="text-sm font-medium {getStatColor(engineerStats.article_created_percentage)}">{engineerStats.article_created_percentage}%</span>
                          </div>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                          <div class="bg-purple-600 h-2 rounded-full" style="width: {engineerStats.article_created_percentage}%"></div>
                        </div>

                        <div class="flex justify-between items-center">
                          <span class="text-sm font-medium text-gray-700">Improvement Opportunity</span>
                          <div class="flex items-center space-x-2">
                            <span class="text-sm text-gray-500">{engineerStats.improvement_opportunity_count}/{engineerStats.total_cases}</span>
                            <span class="text-sm font-medium {getStatColor(engineerStats.improvement_opportunity_percentage)}">{engineerStats.improvement_opportunity_percentage}%</span>
                          </div>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                          <div class="bg-orange-600 h-2 rounded-full" style="width: {engineerStats.improvement_opportunity_percentage}%"></div>
                        </div>

                        <div class="flex justify-between items-center">
                          <span class="text-sm font-medium text-gray-700">Create Opportunity</span>
                          <div class="flex items-center space-x-2">
                            <span class="text-sm text-gray-500">{engineerStats.create_opportunity_count}/{engineerStats.total_cases}</span>
                            <span class="text-sm font-medium {getStatColor(engineerStats.create_opportunity_percentage)}">{engineerStats.create_opportunity_percentage}%</span>
                          </div>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                          <div class="bg-red-600 h-2 rounded-full" style="width: {engineerStats.create_opportunity_percentage}%"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Monthly Comparison Table -->
                <div class="card mb-8">
                  <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-medium text-gray-900">Monthly Comparison</h3>
                  </div>
                  <div class="p-6">
                    <div class="overflow-x-auto">
                      <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                          <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Evaluations</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Link Rate</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Accuracy Rate</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contrib Rate</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">vs Expectation</th>
                          </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                          {#each monthlyData[engineer.id] || [] as monthData}
                            {@const monthStats = monthData.stats}
                            {@const linkRate = monthStats.evaluated_cases > 0 ? Math.round((monthStats.article_linked_count / monthStats.evaluated_cases) * 100) : 0}
                            {@const accuracyRate = monthStats.relevant_link_percentage || 0}
                            {@const contribRate = Math.round((monthStats.article_improved_percentage || 0) + (monthStats.article_created_percentage || 0))}
                            <tr class="hover:bg-gray-50 cursor-pointer">
                              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{monthData.month} {selectedFilters.year}</td>
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {#if monthStats.total_evaluations > 0}
                                  <button 
                                    on:click={() => viewMonthEvaluations(engineer.id, monthData.month, selectedFilters.year || new Date().getFullYear())}
                                    class="text-primary-600 hover:text-primary-800 underline cursor-pointer"
                                    title="Click to view evaluations for {engineer.name} in {monthData.month}"
                                  >
                                    {monthStats.total_evaluations}
                                  </button>
                                {:else}
                                  0
                                {/if}
                              </td>
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <span class="{getStatColor(linkRate)}">{linkRate}%</span>
                              </td>
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <span class="{getStatColor(accuracyRate)}">{accuracyRate}%</span>
                              </td>
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <span class="{getStatColor(contribRate)}">{contribRate}%</span>
                              </td>
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {#if linkRate >= linkRateExpectation + 5}
                                  <span class="text-green-600 font-medium">+{linkRate - linkRateExpectation}%</span>
                                {:else if linkRate >= linkRateExpectation - 5}
                                  <span class="text-yellow-600 font-medium">±{Math.abs(linkRate - linkRateExpectation)}%</span>
                                {:else}
                                  <span class="text-red-600 font-medium">-{linkRateExpectation - linkRate}%</span>
                                {/if}
                              </td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <!-- Monthly Performance Chart -->
                <div class="card mb-8">
                  <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-medium text-gray-900">Monthly Performance Trends</h3>
                  </div>
                  <div class="p-6">
                    <canvas id="monthlyChart_{engineer.id}" width="400" height="100"></canvas>
                  </div>
                </div>
              </div>
            {/if}
          {/each}

          {#if getSelectedEngineers().length > 15}
            <div class="text-center p-4 text-gray-500 bg-gray-50 rounded-lg">
              <p>Showing first 15 engineers. Select fewer engineers to see all individual reports.</p>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if} 