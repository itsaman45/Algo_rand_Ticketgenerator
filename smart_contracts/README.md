# Algorand Smart Contract Setup

This folder contains a standalone smart contract setup for the Ticket Marketplace using **PyTeal**.

## 📂 Files

*   `contract.py`: Defines the smart contract logic (Global State: Price/Supply, Local State: Tickets Owned).
*   `deploy.py`: Script to compile and deploy the contract to Algorand TestNet.
*   `requirements.txt`: Python dependencies.

## 🚀 Setup & Deployment

### 1. Install Python Dependencies
Make sure you have Python installed, then run:
```bash
pip install -r requirements.txt
```

### 2. Configure Your Account
Open `deploy.py` and replace `YOUR_25_WORD_MNEMONIC_HERE` with your **Algorand TestNet Wallet Mnemonic**.
> ⚠️ **IMPORTANT**: Never share this mnemonic or commit it to GitHub if it holds real funds. Use a dedicated TestNet dev wallet.

### 3. Deploy to TestNet
Run the deployment script:
```bash
python deploy.py
```

### 4. Result
The script will print your new **Application ID**.
```
✅ Deployment Successful!
🚀 Application ID: 123456789
```

## 🔌 Connecting to Frontend (Future)
This setup is currently **standalone**. To connect it to your React frontend later:

1.  Copy the `Application ID` generated above.
2.  Update your frontend config (e.g., `.env` or constants file) with this ID.
3.  Use `algosdk.makeApplicationNoOpTxn` in your React components to call the methods:
    *   `setup`: Configure price and supply.
    *   `buy`: Purchase a ticket (requires atomic group transaction with payment).

## 📝 Contract Methods

| Method | Args | Description |
| :--- | :--- | :--- |
| `setup` | `["setup", price, supply]` | Sets the ticket price (MicroAlgos) and total supply. Admin only. |
| `buy` | `["buy"]` | Buy a ticket. Must be grouped with a payment transaction to the contract creator. |
