function generateSimulationInvoicePreview(simulationData) {
    console.log("Generating simulation invoice preview with data:", simulationData);
    sessionStorage.setItem('simulationData', JSON.stringify(simulationData));
    window.open('gerenciador_invoice.html', '_blank');
}