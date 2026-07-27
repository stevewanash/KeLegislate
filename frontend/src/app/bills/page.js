export default function BillsPage() {
  const placeholderBills = [
    {
      id: "1",
      title: "The Motor Vehicle Circulation Tax Bill, 2026",
      date: "July 24, 2026",
      tags: ["Transport & Logistics", "Finance & Mobile Money"],
      excerpt: "Imposes a circulation tax on all motor vehicles in Kenya, setting rates based on engine capacity and vehicle value.",
      status: "translated"
    },
    {
      id: "2",
      title: "The Digital Marketplace Regulation Bill, 2026",
      date: "July 18, 2026",
      tags: ["Digital & Content Creation", "Retail & Market Trading"],
      excerpt: "Establishes registration guidelines and updates withholding tax schedules for digital sales and content platform activities.",
      status: "translated"
    },
    {
      id: "3",
      title: "The Eco-Levy and Plastic Regulations Act, 2026",
      date: "July 12, 2026",
      tags: ["Manufacturing & Artisan", "Hospitality & Food Service"],
      excerpt: "Introduces standard levies on single-use plastics and sets compliance checklists for small-scale manufacturers.",
      status: "translated"
    }
  ];

  return (
    <div className="container animate-fade-in">
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>Browse Legislative Bills</h1>
        <p style={{ color: '#cbd5e1' }}>Select an active draft bill to read its plain-text summary and calculate its financial impact.</p>
      </div>

      {/* Filter and search bar */}
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        marginBottom: '2rem',
        flexWrap: 'wrap'
      }}>
        <input 
          className="form-input" 
          placeholder="Search bills..." 
          style={{ flex: '1 1 300px', maxWidth: '400px' }}
        />
        <select className="form-input" style={{ flex: '1 1 200px', maxWidth: '250px' }}>
          <option value="">All Industries</option>
          <option value="Transport & Logistics">Transport & Logistics</option>
          <option value="Digital & Content Creation">Digital & Content Creation</option>
          <option value="Agriculture & Farming">Agriculture & Farming</option>
          <option value="Retail & Market Trading">Retail & Market Trading</option>
        </select>
      </div>

      {/* Bill List Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        {placeholderBills.map((bill) => (
          <div key={bill.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ fontSize: '1.35rem', flex: '1' }}>
                <a href={`/bills/${bill.id}`} style={{ color: 'white', textDecoration: 'none', transition: 'color 0.2s' }}>
                  {bill.title}
                </a>
              </h2>
              <span className="badge badge-primary">{bill.status}</span>
            </div>
            
            <p style={{ color: '#cbd5e1', fontSize: '0.95rem' }}>{bill.excerpt}</p>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {bill.tags.map((tag, idx) => (
                  <span key={idx} className="badge badge-accent">{tag}</span>
                ))}
              </div>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Published: {bill.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
