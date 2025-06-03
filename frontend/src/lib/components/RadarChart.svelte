<script lang="ts">
    import { onMount } from 'svelte';
    import Chart from 'chart.js/auto';

    export let labels: string[] = [];
    export let teamData: number[] = [];
    export let personalData: number[] | null = null;
    export let width: number = 600;
    export let height: number = 600;

    let canvas: HTMLCanvasElement;
    let chart: Chart;

    onMount(() => {
        const ctx = canvas.getContext('2d');
        const datasets: any[] = [];
        if (teamData.length) {
            datasets.push({
                label: 'Average Team',
                data: teamData,
                backgroundColor: 'rgba(255,205,86,0.2)',
                borderColor: 'rgba(255,205,86,1)',
                pointBackgroundColor: 'rgba(255,205,86,1)',
                borderDash: [5, 5],
            });
        }
        if (personalData && personalData.length) {
            datasets.push({
                label: 'Personal',
                data: personalData,
                backgroundColor: 'rgba(54,162,235,0.2)',
                borderColor: 'rgba(54,162,235,1)',
                pointBackgroundColor: 'rgba(54,162,235,1)',
            });
        }
        chart = new Chart(ctx, {
            type: 'radar',
            data: { labels, datasets },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        min: 0,
                        max: 100,
                        ticks: { stepSize: 20 }
                    }
                }
            }
        });
    });

    // Rebuild chart when inputs change
    $: if (chart) {
        // update labels and datasets
        chart.data.labels = labels;
        const newDatasets: any[] = [];
        if (teamData.length) {
            newDatasets.push({
                label: 'Average Team',
                data: teamData,
                backgroundColor: 'rgba(255,205,86,0.2)',
                borderColor: 'rgba(255,205,86,1)',
                pointBackgroundColor: 'rgba(255,205,86,1)',
                borderDash: [5, 5],
            });
        }
        if (personalData && personalData.length) {
            newDatasets.push({
                label: 'Personal',
                data: personalData,
                backgroundColor: 'rgba(54,162,235,0.2)',
                borderColor: 'rgba(54,162,235,1)',
                pointBackgroundColor: 'rgba(54,162,235,1)',
            });
        }
        chart.data.datasets = newDatasets;
        chart.update();
    }
</script>

<canvas bind:this={canvas} style="width: {width}px; height: {height}px;"></canvas>
