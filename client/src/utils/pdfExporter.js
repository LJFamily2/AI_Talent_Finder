import jsPDF from "jspdf";
import Chart from "chart.js/auto";

/**
 * Utility class for exporting researcher profiles to PDF
 * Handles both single and multiple researchers
 */
export class ResearcherPDFExporter {
  constructor() {
    this.doc = null;
    this.pageWidth = 0;
    this.pageHeight = 0;
    this.margin = 15;
    this.usableWidth = 0;
    this.currentY = 0;
  }

  /**
   * Initialize a new PDF document
   */
  initializeDocument() {
    this.doc = new jsPDF();
    this.pageWidth = this.doc.internal.pageSize.width;
    this.pageHeight = this.doc.internal.pageSize.height;
    this.usableWidth = this.pageWidth - this.margin * 2;
    this.currentY = 20;
  }

  /**
   * Generate chart image for PDF inclusion
   */
  generateChartImage(chartData, title, color = "#1a73e8") {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 220;
      const ctx = canvas.getContext("2d");

      new Chart(ctx, {
        type: "bar",
        data: {
          labels: chartData.labels,
          datasets: [
            {
              label: title,
              data: chartData.data,
              backgroundColor: color + "70",
              borderColor: color,
              borderWidth: 1.5,
              borderRadius: 3,
              borderSkipped: false,
            },
          ],
        },
        options: {
          responsive: false,
          animation: false,
          plugins: {
            title: {
              display: true,
              text: title,
              font: {
                size: 14,
                weight: "bold",
              },
              color: "#374151",
              padding: {
                top: 8,
                bottom: 12,
              },
            },
            legend: {
              display: false,
            },
          },
          scales: {
            x: {
              grid: {
                display: false,
              },
              ticks: {
                font: {
                  size: 10,
                },
                color: "#6b7280",
                maxRotation: 0,
              },
            },
            y: {
              beginAtZero: true,
              grid: {
                color: "#f3f4f6",
                drawBorder: false,
              },
              ticks: {
                font: {
                  size: 10,
                },
                color: "#6b7280",
              },
            },
          },
          layout: {
            padding: {
              left: 8,
              right: 8,
              top: 8,
              bottom: 8,
            },
          },
        },
      });

      setTimeout(() => {
        const imageData = canvas.toDataURL("image/png");
        resolve(imageData);
      }, 100);
    });
  }

  /**
   * Create professional header for researcher
   */
  createHeader(researcher) {
    // Professional Header
    this.doc.setFillColor(37, 99, 235);
    this.doc.rect(0, 0, this.pageWidth, 35, "F");

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(20);
    this.doc.setFont(undefined, "bold");
    this.doc.text(
      researcher.basic_info?.name || "Researcher Profile",
      this.margin,
      22
    );

    if (researcher.identifiers?.orcid) {
      this.doc.setFontSize(10);
      this.doc.setFont(undefined, "normal");
      this.doc.text(`ORCID: ${researcher.identifiers.orcid}`, this.margin, 30);
    }

    this.currentY = 45;
    this.doc.setTextColor(0, 0, 0);
  }

  /**
   * Add key metrics section
   */
  addMetricsSection(researcher) {
    const {
      h_index = 0,
      i10_index = 0,
      two_year_mean_citedness = 0,
      total_citations = 0,
      total_works = 0,
    } = researcher.research_metrics || {};

    this.doc.setFontSize(14);
    this.doc.setFont(undefined, "bold");
    this.doc.setTextColor(37, 99, 235);
    this.doc.text("Key Research Metrics", this.margin, this.currentY);
    this.currentY += 8;

    const metricsData = [
      { label: "Total Works", value: total_works.toLocaleString() },
      { label: "Total Citations", value: total_citations.toLocaleString() },
      { label: "h-index", value: h_index.toLocaleString() },
      { label: "i10-index", value: i10_index.toLocaleString() },
      {
        label: "2-Year Mean Citedness",
        value: two_year_mean_citedness?.toFixed(2) || "N/A",
      },
    ];

    // Background box for metrics - adjusted width for 5 metrics
    this.doc.setFillColor(248, 250, 252);
    this.doc.rect(this.margin, this.currentY, this.usableWidth, 22, "F");
    this.doc.setDrawColor(229, 231, 235);
    this.doc.setLineWidth(0.5);
    this.doc.rect(this.margin, this.currentY, this.usableWidth, 22);

    const metricWidth = this.usableWidth / 5; // Now 5 metrics instead of 4
    metricsData.forEach((metric, index) => {
      const x = this.margin + index * metricWidth + 6; // Adjusted spacing

      // Vertical separators
      if (index > 0) {
        this.doc.setDrawColor(229, 231, 235);
        this.doc.line(
          this.margin + index * metricWidth,
          this.currentY,
          this.margin + index * metricWidth,
          this.currentY + 22
        );
      }

      // Value (bold, prominent)
      this.doc.setFont(undefined, "bold");
      this.doc.setFontSize(11); // Slightly smaller font for more metrics
      this.doc.setTextColor(37, 99, 235);
      this.doc.text(metric.value, x, this.currentY + 10);

      // Label (smaller, descriptive)
      this.doc.setFont(undefined, "normal");
      this.doc.setFontSize(7); // Smaller font for labels
      this.doc.setTextColor(107, 114, 128);
      this.doc.text(metric.label, x, this.currentY + 18);
    });

    this.currentY += 30;
  }

  /**
   * Add research trends section with charts
   */
  async addResearchTrends(researcher) {
    const { citation_trends: { counts_by_year = [] } = {} } = researcher;

    if (counts_by_year.length === 0) return;

    const citationYears = counts_by_year
      .map((d) => String(d.year).replace(/,/g, ""))
      .reverse();
    const citationCounts = counts_by_year
      .map((d) => d.cited_by_count)
      .reverse();
    const workYears = counts_by_year
      .map((d) => String(d.year).replace(/,/g, ""))
      .reverse();
    const workCounts = counts_by_year.map((d) => d.works_count).reverse();

    if (workYears.length > 0 && workCounts.length > 0) {
      this.doc.setFontSize(14);
      this.doc.setFont(undefined, "bold");
      this.doc.setTextColor(37, 99, 235);
      this.doc.text("Research Activity Trends", this.margin, this.currentY);
      this.currentY += 12;

      try {
        const worksChartImage = await this.generateChartImage(
          { labels: workYears, data: workCounts },
          "Works Per Year",
          "#2563eb"
        );

        const citationsChartImage = await this.generateChartImage(
          { labels: citationYears, data: citationCounts },
          "Citations Per Year",
          "#10b981"
        );

        // Charts side by side with proper spacing
        this.doc.addImage(
          worksChartImage,
          "PNG",
          this.margin,
          this.currentY,
          85,
          45
        );
        this.doc.addImage(
          citationsChartImage,
          "PNG",
          this.margin + 95,
          this.currentY,
          85,
          45
        );

        this.currentY += 55;

        // Add chart descriptions
        this.doc.setFontSize(9);
        this.doc.setFont(undefined, "normal");
        this.doc.setTextColor(75, 85, 99);

        // Works Per Year description
        const worksDesc = `This chart shows yearly research publication counts`;
        const worksDescLines = this.doc.splitTextToSize(worksDesc, 85);
        this.doc.text(worksDescLines, this.margin, this.currentY);

        // Citations Per Year description
        const citationsDesc = `This chart shows yearly citation counts`;
        const citationsDescLines = this.doc.splitTextToSize(citationsDesc, 85);
        this.doc.text(citationsDescLines, this.margin + 95, this.currentY);

        // Calculate the height needed for descriptions and add padding
        const maxDescHeight =
          Math.max(worksDescLines.length, citationsDescLines.length) * 4;
        this.currentY += maxDescHeight + 10;
      } catch (error) {
        console.warn("Error generating charts for PDF:", error);
        this.currentY += 10;
      }
    }
  }

  /**
   * Add section with full text display
   */
  addFullDisplaySection(title, items, itemKeyPath = "display_name") {
    if (!items || items.length === 0) return;

    // Check if we need a new page
    if (this.currentY > this.pageHeight - 60) {
      this.doc.addPage();
      this.currentY = 25;
    }

    this.doc.setFontSize(14);
    this.doc.setFont(undefined, "bold");
    this.doc.setTextColor(37, 99, 235);
    this.doc.text(title, this.margin, this.currentY);
    this.currentY += 10;

    // Determine if we should use 2-column layout
    const useColumnLayout = items.length >= 10;

    if (useColumnLayout) {
      // 2-column layout for large lists
      const columnWidth = (this.usableWidth - 20) / 2; // 20px gap between columns
      const leftColumnX = this.margin;
      const rightColumnX = this.margin + columnWidth + 20;

      const itemsPerColumn = Math.ceil(items.length / 2);
      let leftColumnY = this.currentY;
      let rightColumnY = this.currentY;

      items.forEach((item, index) => {
        const value = itemKeyPath.includes(".")
          ? itemKeyPath.split(".").reduce((obj, key) => obj?.[key], item)
          : item[itemKeyPath] || item;

        const displayText = value || "N/A";

        const isLeftColumn = index < itemsPerColumn;
        const columnX = isLeftColumn ? leftColumnX : rightColumnX;
        let columnY = isLeftColumn ? leftColumnY : rightColumnY;

        // Check if we need a new page
        if (columnY > this.pageHeight - 20) {
          this.doc.addPage();
          this.currentY = 25;
          leftColumnY = this.currentY;
          rightColumnY = this.currentY;
          columnY = this.currentY;
        }

        // Add bullet point
        this.doc.setFont(undefined, "normal");
        this.doc.setFontSize(10);
        this.doc.setTextColor(31, 41, 55);
        this.doc.text("•", columnX, columnY);

        // Split long text into multiple lines if needed
        const maxWidth = columnWidth - 10;
        const textLines = this.doc.splitTextToSize(displayText, maxWidth);

        this.doc.text(textLines, columnX + 8, columnY);

        // Calculate height based on number of lines
        const lineHeight = 5;
        const textHeight = textLines.length * lineHeight;
        const itemHeight = Math.max(textHeight, lineHeight) + 2;

        if (isLeftColumn) {
          leftColumnY += itemHeight;
        } else {
          rightColumnY += itemHeight;
        }
      });

      // Set currentY to the bottom of the tallest column
      this.currentY = Math.max(leftColumnY, rightColumnY) + 8;
    } else {
      // Single column layout for smaller lists
      items.forEach((item) => {
        const value = itemKeyPath.includes(".")
          ? itemKeyPath.split(".").reduce((obj, key) => obj?.[key], item)
          : item[itemKeyPath] || item;

        const displayText = value || "N/A";

        // Check if we need a new page
        if (this.currentY > this.pageHeight - 20) {
          this.doc.addPage();
          this.currentY = 25;
        }

        // Add bullet point
        this.doc.setFont(undefined, "normal");
        this.doc.setFontSize(10);
        this.doc.setTextColor(31, 41, 55);
        this.doc.text("•", this.margin, this.currentY);

        // Split long text into multiple lines if needed
        const maxWidth = this.usableWidth - 10;
        const textLines = this.doc.splitTextToSize(displayText, maxWidth);

        this.doc.text(textLines, this.margin + 8, this.currentY);

        // Calculate height based on number of lines
        const lineHeight = 5;
        const textHeight = textLines.length * lineHeight;
        this.currentY += Math.max(textHeight, lineHeight) + 2;
      });

      this.currentY += 8; // Extra spacing between sections
    }
  }

  /**
   * Add affiliations and research areas sections
   */
  addProfileSections(researcher) {
    const { basic_info: { affiliations = [] } = {} } = researcher;
    const { research_areas: { fields = [], topics = [] } = {} } = researcher;
    const {
      current_affiliation: {
        institution: currentInst = "",
        display_name: currentInstDisplayName = "",
      } = {},
    } = researcher;

    const currentAffiliations =
      Array.isArray(researcher.current_affiliations) &&
      researcher.current_affiliations.length > 0
        ? researcher.current_affiliations
        : [];

    const pastAffiliations = affiliations.filter(
      (aff) =>
        aff.institution?.display_name !==
        (currentInstDisplayName || currentInst)
    );

    // Apply full display to all sections
    this.addFullDisplaySection(
      "Current Affiliations",
      currentAffiliations,
      "display_name"
    );
    this.addFullDisplaySection(
      "Past Affiliations",
      pastAffiliations,
      "institution.display_name"
    );
    this.addFullDisplaySection("Research Fields", fields, "display_name");
    this.addFullDisplaySection("Research Topics", topics, "display_name");
  }

  /**
   * Add page numbers to all pages
   */
  addPageNumbers() {
    const totalPages = this.doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(9);
      this.doc.setTextColor(107, 114, 128);
      this.doc.text(
        `${i}`,
        this.pageWidth - this.margin - 5,
        this.pageHeight - 10,
        {
          align: "right",
        }
      );
    }
  }

  /**
   * Generate filename for export
   */
  generateFileName(researchers) {
    if (researchers.length === 1) {
      const safeName = (researchers[0].basic_info?.name || "researcher")
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_]/g, "");
      const dateStr = new Date().toISOString().slice(0, 10);
      return `${safeName}_profile_${dateStr}`;
    } else {
      const dateStr = new Date().toISOString().slice(0, 10);
      return `researchers_profiles_${researchers.length}_${dateStr}`;
    }
  }

  /**
   * Add separator page between researchers (for multiple researcher export)
   */
  addResearcherSeparator() {
    this.doc.addPage();
    this.currentY = 20;
  }

  /**
   * Export single researcher to PDF
   */
  async exportSingleResearcher(researcher, options = {}) {
    const { includePageNumbers = true } = options;

    this.initializeDocument();
    this.createHeader(researcher);
    this.addMetricsSection(researcher);
    await this.addResearchTrends(researcher);
    this.addProfileSections(researcher);

    if (includePageNumbers) {
      this.addPageNumbers();
    }

    const filename = this.generateFileName([researcher]);
    this.doc.save(`${filename}.pdf`);
  }

  /**
   * Export multiple researchers to PDF
   */
  async exportMultipleResearchers(researchers, options = {}) {
    if (researchers.length === 0) {
      throw new Error("No researchers to export");
    }

    if (researchers.length === 1) {
      return this.exportSingleResearcher(researchers[0], options);
    }

    const { includePageNumbers = false } = options;

    this.initializeDocument();

    // Process each researcher
    for (let i = 0; i < researchers.length; i++) {
      const researcher = researchers[i];

      if (i > 0) {
        this.addResearcherSeparator();
      }

      this.createHeader(researcher);
      this.addMetricsSection(researcher);
      await this.addResearchTrends(researcher);
      this.addProfileSections(researcher);
    }

    if (includePageNumbers) {
      this.addPageNumbers();
    }

    const filename = this.generateFileName(researchers);
    this.doc.save(`${filename}.pdf`);
  }

  /**
   * Main export method - handles both single and multiple researchers
   */
  async exportToPDF(researchers, options = {}) {
    if (!Array.isArray(researchers)) {
      researchers = [researchers];
    }

    if (researchers.length === 0) {
      throw new Error("No researchers provided for export");
    }

    return researchers.length === 1
      ? this.exportSingleResearcher(researchers[0], options)
      : this.exportMultipleResearchers(researchers, options);
  }
}

/**
 * Convenience function to export researchers to PDF
 * @param {Array|Object} researchers - Single researcher object or array of researchers
 * @param {Object} options - Export options
 * @param {boolean} options.includePageNumbers - Include page numbers (default: true for single, false for multiple)
 * @returns {Promise} - Promise that resolves when PDF is generated and downloaded
 */
export const exportResearchersToPDF = async (researchers, options = {}) => {
  const exporter = new ResearcherPDFExporter();
  return exporter.exportToPDF(researchers, options);
};

export default ResearcherPDFExporter;
