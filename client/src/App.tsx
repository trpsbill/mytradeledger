function App() {
  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl">MyTradeLedger</a>
        </div>
      </div>
      <main className="container mx-auto p-4">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Welcome to MyTradeLedger</h2>
            <p>A simple crypto trade logging application.</p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
