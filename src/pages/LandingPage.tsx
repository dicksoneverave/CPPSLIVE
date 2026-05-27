import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { supabase, checkSupabaseConnection } from '../services/supabase';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartData
} from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface MonthlyData {
  Month: string;
  IncidentCount: number;
}

interface CompensationData {
  SubmissionMonth: string;
  TotalCompensation: number;
}

interface YearlyClaimCount {
  year: number;
  injury_count: number;
  death_count: number;
}

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [injuryData, setInjuryData] = useState<ChartData<'pie'>>({
    labels: [],
    datasets: []
  });
  const [deathData, setDeathData] = useState<ChartData<'pie'>>({
    labels: [],
    datasets: []
  });
  const [incidentBarData, setIncidentBarData] = useState<ChartData<'bar'>>({
    labels: [],
    datasets: []
  });
  const [totalClaimsData, setTotalClaimsData] = useState<ChartData<'line'>>({
    labels: [],
    datasets: []
  });
  const [claimsReceivedData, setClaimsReceivedData] = useState<ChartData<'bar'>>({
    labels: [],
    datasets: []
  });
  const [claimsSettledData, setClaimsSettledData] = useState<ChartData<'bar'>>({
    labels: [],
    datasets: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const checkConnection = async () => {
      const connected = await checkSupabaseConnection();
      setIsConnected(connected);
      if (!connected) {
        setError('Unable to connect to the database. Please check your internet connection and try again.');
        setLoading(false);
      }
      return connected;
    };

    const fetchChartData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check connection before proceeding
        const connected = await checkConnection();
        if (!connected) return;

        // Get current year
        const currentYear = new Date().getFullYear();

        // Check if Supabase is properly configured
        if (!supabase) {
          throw new Error('Supabase client is not initialized');
        }

        // Define months arrays for consistent usage
        const months = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];

        const shortMonths = [
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];

        // Initialize arrays with zeros for all months
        let injuryByMonth: MonthlyData[] = months.map(month => ({
          Month: month,
          IncidentCount: 0
        }));

        let deathByMonth: MonthlyData[] = months.map(month => ({
          Month: month,
          IncidentCount: 0
        }));

        // Fetch injury cases data
        const { data: injuryData, error: injuryError } = await supabase
          .from('form1112master')
          .select('FirstSubmissionDate')
          .eq('IncidentType', 'Injury')
          .gte('FirstSubmissionDate', `${currentYear}-01-01`)
          .lte('FirstSubmissionDate', `${currentYear}-12-31`);

        if (injuryError) {
          console.error('Error fetching injury data:', injuryError);
          throw new Error(`Failed to fetch injury data: ${injuryError.message}`);
        } else if (injuryData && injuryData.length > 0) {
          // Process injury data by month
          const processedInjuryData = processDataByMonth(injuryData);

          // Update the zero-initialized array with actual counts
          processedInjuryData.forEach(item => {
            const index = months.findIndex(month => month === item.Month);
            if (index !== -1) {
              injuryByMonth[index].IncidentCount = item.IncidentCount;
            }
          });
        }

        // Fetch death cases data
        const { data: deathData, error: deathError } = await supabase
          .from('form1112master')
          .select('FirstSubmissionDate')
          .eq('IncidentType', 'Death')
          .gte('FirstSubmissionDate', `${currentYear}-01-01`)
          .lte('FirstSubmissionDate', `${currentYear}-12-31`);

        if (deathError) {
          console.error('Error fetching death data:', deathError);
          throw new Error(`Failed to fetch death data: ${deathError.message}`);
        } else if (deathData && deathData.length > 0) {
          // Process death data by month
          const processedDeathData = processDataByMonth(deathData);

          // Update the zero-initialized array with actual counts
          processedDeathData.forEach(item => {
            const index = months.findIndex(month => month === item.Month);
            if (index !== -1) {
              deathByMonth[index].IncidentCount = item.IncidentCount;
            }
          });
        }

        // Create pie chart data for injury cases
        setInjuryData({
          labels: injuryByMonth.map(item => item.Month),
          datasets: [
            {
              label: 'Injury Cases',
              data: injuryByMonth.map(item => item.IncidentCount),
              backgroundColor: [
                'rgba(255, 99, 132, 0.6)',
                'rgba(54, 162, 235, 0.6)',
                'rgba(255, 206, 86, 0.6)',
                'rgba(75, 192, 192, 0.6)',
                'rgba(153, 102, 255, 0.6)',
                'rgba(255, 159, 64, 0.6)',
                'rgba(255, 99, 132, 0.6)',
                'rgba(54, 162, 235, 0.6)',
                'rgba(255, 206, 86, 0.6)',
                'rgba(75, 192, 192, 0.6)',
                'rgba(153, 102, 255, 0.6)',
                'rgba(255, 159, 64, 0.6)'
              ],
              borderColor: [
                'rgba(255, 99, 132, 1)',
                'rgba(54, 162, 235, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(255, 159, 64, 1)',
                'rgba(255, 99, 132, 1)',
                'rgba(54, 162, 235, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(255, 159, 64, 1)'
              ],
              borderWidth: 1,
            },
          ],
        });

        // Create pie chart data for death cases
        setDeathData({
          labels: deathByMonth.map(item => item.Month),
          datasets: [
            {
              label: 'Death Cases',
              data: deathByMonth.map(item => item.IncidentCount),
              backgroundColor: [
                'rgba(54, 162, 235, 0.6)',
                'rgba(255, 99, 132, 0.6)',
                'rgba(255, 206, 86, 0.6)',
                'rgba(75, 192, 192, 0.6)',
                'rgba(153, 102, 255, 0.6)',
                'rgba(255, 159, 64, 0.6)',
                'rgba(54, 162, 235, 0.6)',
                'rgba(255, 99, 132, 0.6)',
                'rgba(255, 206, 86, 0.6)',
                'rgba(75, 192, 192, 0.6)',
                'rgba(153, 102, 255, 0.6)',
                'rgba(255, 159, 64, 0.6)'
              ],
              borderColor: [
                'rgba(54, 162, 235, 1)',
                'rgba(255, 99, 132, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(255, 159, 64, 1)',
                'rgba(54, 162, 235, 1)',
                'rgba(255, 99, 132, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(255, 159, 64, 1)'
              ],
              borderWidth: 1,
            },
          ],
        });

        // Initialize arrays for injury and death counts with zeros
        const injuryCounts = Array(12).fill(0);
        const deathCounts = Array(12).fill(0);

        // Fill in the actual counts
        injuryByMonth.forEach(item => {
          const monthIndex = getMonthIndex(item.Month);
          if (monthIndex !== -1) {
            injuryCounts[monthIndex] = item.IncidentCount;
          }
        });

        deathByMonth.forEach(item => {
          const monthIndex = getMonthIndex(item.Month);
          if (monthIndex !== -1) {
            deathCounts[monthIndex] = item.IncidentCount;
          }
        });

        // Create bar chart data for injury vs death by month
        setIncidentBarData({
          labels: shortMonths,
          datasets: [
            {
              label: 'Injury Cases',
              data: injuryCounts,
              backgroundColor: 'rgba(255, 99, 132, 0.6)',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 1
            },
            {
              label: 'Death Cases',
              data: deathCounts,
              backgroundColor: 'rgba(54, 162, 235, 0.6)',
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 1
            }
          ]
        });

        // Create line chart data for total claims last 7 years
        const startYear = currentYear - 6;
        const years = Array.from({ length: 7 }, (_, i) => (startYear + i).toString());

        // Initialize arrays for historical data with zeros
        const injuryByYear = Array(7).fill(0);
        const deathByYear = Array(7).fill(0);

        // Fetch historical data using the database function
        const { data: yearlyData, error: yearlyError } = await supabase.rpc(
          'get_yearly_claim_counts',
          { start_year: startYear }
        );

        if (yearlyError) {
          console.error('Error fetching yearly claim counts:', yearlyError);
          throw new Error(`Failed to fetch yearly claim counts: ${yearlyError.message}`);
        } else if (yearlyData && yearlyData.length > 0) {
          // Map the data to the arrays
          yearlyData.forEach((item: YearlyClaimCount) => {
            const yearIndex = item.year - startYear;
            if (yearIndex >= 0 && yearIndex < 7) {
              injuryByYear[yearIndex] = item.injury_count;
              deathByYear[yearIndex] = item.death_count;
            }
          });
        }

        setTotalClaimsData({
          labels: years,
          datasets: [
            {
              label: 'Injury Claims',
              data: injuryByYear,
              borderColor: 'rgba(255, 99, 132, 1)',
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              tension: 0.4,
              fill: true
            },
            {
              label: 'Death Claims',
              data: deathByYear,
              borderColor: 'rgba(54, 162, 235, 1)',
              backgroundColor: 'rgba(54, 162, 235, 0.2)',
              tension: 0.4,
              fill: true
            }
          ]
        });

        // Initialize compensation data with zeros
        const claimsReceivedByMonth = shortMonths.map(month => ({
          SubmissionMonth: month,
          TotalCompensation: 0
        }));

        const claimsSettledByMonth = shortMonths.map(month => ({
          SubmissionMonth: month,
          TotalCompensation: 0
        }));

        // Try to fetch real compensation data with graceful fallback
        try {
          // For claims received
          try {
            const { data: receivedData, error: receivedError } = await supabase.rpc(
              'get_claims_received_by_month',
              { current_year: currentYear }
            );

            if (receivedError) {
              console.warn('Claims received function not available:', receivedError.message);
              // Continue with zero values - this is not a critical error
            } else if (receivedData && receivedData.length > 0) {
              // Update the zero-initialized array with actual values
              receivedData.forEach((item: any) => {
                const monthIndex = shortMonths.findIndex(m =>
                  m.toLowerCase() === item.submission_month.toLowerCase().substring(0, 3)
                );

                if (monthIndex !== -1) {
                  claimsReceivedByMonth[monthIndex].TotalCompensation = item.total_compensation || 0;
                }
              });
            }
          } catch (receivedFetchError) {
            console.warn('Failed to fetch claims received data, using default values:', receivedFetchError);
            // Continue with zero values - this is not a critical error
          }

          // For claims settled
          try {
            const { data: settledData, error: settledError } = await supabase.rpc(
              'get_claims_settled_by_month',
              { current_year: currentYear }
            );

            if (settledError) {
              console.warn('Claims settled function not available:', settledError.message);
              // Continue with zero values - this is not a critical error
            } else if (settledData && settledData.length > 0) {
              // Update the zero-initialized array with actual values
              settledData.forEach((item: any) => {
                const monthIndex = shortMonths.findIndex(m =>
                  m.toLowerCase() === item.submission_month.toLowerCase().substring(0, 3)
                );

                if (monthIndex !== -1) {
                  claimsSettledByMonth[monthIndex].TotalCompensation = item.total_compensation || 0;
                }
              });
            }
          } catch (settledFetchError) {
            console.warn('Failed to fetch claims settled data, using default values:', settledFetchError);
            // Continue with zero values - this is not a critical error
          }

        } catch (err) {
          console.warn('Error fetching compensation data, using default values:', err);
          // Continue with zero values - this is not a critical error
        }

        setClaimsReceivedData({
          labels: shortMonths,
          datasets: [
            {
              label: 'Value of Claims Received (K)',
              data: claimsReceivedByMonth.map(item => item.TotalCompensation),
              backgroundColor: 'rgba(75, 192, 192, 0.6)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1
            }
          ]
        });

        setClaimsSettledData({
          labels: shortMonths,
          datasets: [
            {
              label: 'Value of Claims Settled (K)',
              data: claimsSettledByMonth.map(item => item.TotalCompensation),
              backgroundColor: 'rgba(153, 102, 255, 0.6)',
              borderColor: 'rgba(153, 102, 255, 1)',
              borderWidth: 1
            }
          ]
        });

      } catch (error) {
        console.error('Error fetching chart data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load chart data. Please try again later.');
        setIsConnected(false);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();

    // Set up interval to refresh data every 3000 seconds for real-time updates
    const interval = setInterval(() => {
      fetchChartData();
    }, 3000000); // 3000 seconds = 50 minutes

    return () => clearInterval(interval);
  }, []);

  // Process data by month
  const processDataByMonth = (data: any[]): MonthlyData[] => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Initialize counts for all months
    const monthlyCounts: { [key: string]: number } = {};
    months.forEach(month => {
      monthlyCounts[month] = 0;
    });

    // Count incidents by month
    data.forEach(item => {
      if (item.FirstSubmissionDate) {
        const date = new Date(item.FirstSubmissionDate);
        const month = months[date.getMonth()];
        monthlyCounts[month]++;
      }
    });

    // Convert to array format
    return months.map(month => ({
      Month: month,
      IncidentCount: monthlyCounts[month]
    }));
  };

  // Process data by year
  const processDataByYear = (data: any[], startYear: number, endYear: number): number[] => {
    // Initialize counts for all years
    const yearCounts: { [key: number]: number } = {};
    for (let year = startYear; year <= endYear; year++) {
      yearCounts[year] = 0;
    }

    // Count incidents by year
    data.forEach(item => {
      if (item.FirstSubmissionDate) {
        const date = new Date(item.FirstSubmissionDate);
        const year = date.getFullYear();
        if (year >= startYear && year <= endYear) {
          yearCounts[year]++;
        }
      }
    });

    // Convert to array format
    return Object.values(yearCounts);
  };

  // Helper function to get month index
  const getMonthIndex = (monthName: string): number => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const shortMonths = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    // Try full month name first
    let index = months.indexOf(monthName);

    // If not found, try short month name
    if (index === -1) {
      index = shortMonths.indexOf(monthName);
    }

    return index;
  };

  const processSteps = [
    {
      number: 1,
      title: 'File a Claim',
      description: 'Submit your injury or death claim through our online system'
    },
    {
      number: 2,
      title: 'Claim Review',
      description: 'Your claim will be reviewed by our team'
    },
    {
      number: 3,
      title: 'Approval Process',
      description: 'Claims are processed through our approval workflow'
    },
    {
      number: 4,
      title: 'Compensation',
      description: 'Approved claims proceed to payment processing'
    }
  ];

  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <section className="py-1 bg-primary">

        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Welcome to Claims Processing & Payment System
          </h1>
          <p className="text-white/80 max-w-2xl mx-auto mb-6">
            A comprehensive solution for managing workers compensation claims, designed for the Office
            of Workers Compensation in Papua New Guinea.
          </p>

        </div>
      </section>

      {/* Charts Section */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          {!isConnected && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
              <p className="font-medium">Connection Error</p>
              <p>Unable to connect to the database. Please check your internet connection and try again.</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              >
                Retry Connection
              </button>
            </div>
          )}

          {error && error !== 'Unable to connect to the database. Please check your internet connection and try again.' && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-700">
              {error}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Injury Cases Chart */}
            <div className="card hover:shadow-lg">
              <h3 className="text-xl font-semibold mb-4">Injury Cases Registered This Year</h3>
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  {injuryData.datasets[0].data.some(value => value > 0) ? (
                    <Pie
                      data={injuryData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'right',
                            labels: {
                              boxWidth: 15,
                              font: {
                                size: 12
                              }
                            }
                          },
                          title: {
                            display: false
                          }
                        }
                      }}
                    />
                  ) : (
                    <p className="text-gray-500">No injury cases registered this year</p>
                  )}
                </div>
              )}
            </div>

            {/* Death Cases Chart */}
            <div className="card hover:shadow-lg">
              <h3 className="text-xl font-semibold mb-4">Death Cases Registered This Year</h3>
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  {deathData.datasets[0].data.some(value => value > 0) ? (
                    <Pie
                      data={deathData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'right',
                            labels: {
                              boxWidth: 15,
                              font: {
                                size: 12
                              }
                            }
                          },
                          title: {
                            display: false
                          }
                        }
                      }}
                    />
                  ) : (
                    <p className="text-gray-500">No death cases registered this year</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Incident Chart: Injury vs Death */}
          <div className="card hover:shadow-lg mb-8">
            <h3 className="text-xl font-semibold mb-4">Incident Chart: Injury vs Death This Year</h3>
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="h-64">
                <Bar
                  data={incidentBarData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top',
                      },
                      title: {
                        display: false
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true
                      }
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Total Claims Last 7 Years */}
          <div className="card hover:shadow-lg mb-8">
            <h3 className="text-xl font-semibold mb-4">Total Claims Last 7 Years</h3>
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="h-64">
                <Line
                  data={totalClaimsData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top',
                      },
                      title: {
                        display: false
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true
                      }
                    }
                  }}
                />
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Value of Claims Received This Year */}
            <div className="card hover:shadow-lg">
              <h3 className="text-xl font-semibold mb-4">Value of Claims Received This Year</h3>
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="h-64">
                  <Bar
                    data={claimsReceivedData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top',
                        },
                        title: {
                          display: false
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            callback: function (value) {
                              return 'K' + value.toLocaleString();
                            }
                          }
                        }
                      }
                    }}
                  />
                </div>
              )}
            </div>

            {/* Value of Claims Settled This Year */}
            <div className="card hover:shadow-lg">
              <h3 className="text-xl font-semibold mb-4">Value of Claims Settled This Year</h3>
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="h-64">
                  <Bar
                    data={claimsSettledData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top',
                        },
                        title: {
                          display: false
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            callback: function (value) {
                              return 'K' + value.toLocaleString();
                            }
                          }
                        }
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 text-gray-900">
            How It Works
          </h2>

          <div className="grid md:grid-cols-4 gap-4 md:gap-8">
            {processSteps.map((step, index) => (
              <div key={index} className="step-item">
                <div className="step-circle">{step.number}</div>
                <h3 className="font-semibold mb-2 text-center">{step.title}</h3>
                <p className="text-sm text-gray-600 text-center">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-10 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-xl md:text-2xl font-semibold text-white mb-4">
            Ready to manage your workers compensation claims?
          </h2>
          <button
            onClick={() => navigate('/login')}
            className="btn bg-white text-primary hover:bg-gray-100 inline-flex items-center"
          >
            Get Started <ArrowRight size={16} className="ml-2" />
          </button>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
