# ===============================
# ALGorand Smart Contract Deploy Script
# ===============================

from algosdk.v2client import algod
from algosdk.transaction import ApplicationCreateTxn, StateSchema, wait_for_confirmation
from algosdk import account, mnemonic
from pyteal import compileTeal, Mode
from contract import ticketing_contract
import base64


# ===============================
# CONFIGURATION
# ===============================

# 👉 Paste your 25-word mnemonic here
MNEMONIC = "artefact prevent tattoo oppose place wheel maximum tuition thrive usage kiwi verb gain exclude reflect alcohol erupt vacuum glue talk piece source horror ability attract"

# Algorand TestNet Node
ALGOD_ADDRESS = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN = ""


# ===============================
# GET ACCOUNT FROM MNEMONIC
# ===============================
def get_account():
    try:
        private_key = mnemonic.to_private_key(MNEMONIC)
        address = account.address_from_private_key(private_key)
        return address, private_key
    except Exception:
        print("❌ Error: Invalid Mnemonic. Update MNEMONIC in deploy.py")
        return None, None


# ===============================
# COMPILE TEAL PROGRAM
# ===============================
def compile_program(client, source_code):
    compiled = client.compile(source_code)
    return base64.b64decode(compiled["result"])


# ===============================
# DEPLOY CONTRACT
# ===============================
def deploy():

    print("🔗 Connecting to Algorand TestNet...")
    client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)

    # Get creator account
    creator_address, private_key = get_account()
    if not creator_address:
        return

    print("🚀 Deploying from account:", creator_address)

    # Compile PyTeal → TEAL
    print("⚙️ Compiling PyTeal contract...")
    approval_source = compileTeal(
        ticketing_contract(),
        mode=Mode.Application,
        version=6
    )

    clear_source = compileTeal(
        ticketing_contract(),
        mode=Mode.Application,
        version=6
    )

    # Compile TEAL → Bytecode
    approval_program = compile_program(client, approval_source)
    clear_program = compile_program(client, clear_source)

    # State schema
    global_schema = StateSchema(num_uints=4, num_byte_slices=4)
    local_schema = StateSchema(num_uints=2, num_byte_slices=2)

    # Suggested transaction params
    params = client.suggested_params()

    print("📦 Creating application transaction...")

    txn = ApplicationCreateTxn(
        sender=creator_address,
        sp=params,
        on_complete=0,  # NoOp
        approval_program=approval_program,
        clear_program=clear_program,
        global_schema=global_schema,
        local_schema=local_schema,
    )

    # Sign transaction
    signed_txn = txn.sign(private_key)

    print("📡 Sending transaction...")
    tx_id = client.send_transaction(signed_txn)

    print("⏳ Waiting for confirmation...")
    confirmed_txn = wait_for_confirmation(client, tx_id, 4)

    app_id = confirmed_txn["application-index"]

    print("\n✅ DEPLOYMENT SUCCESSFUL")
    print("📌 Application ID:", app_id)
    print("🔎 View on AlgoExplorer:")
    print(f"https://testnet.algoexplorer.io/application/{app_id}")


# ===============================
# RUN
# ===============================
if __name__ == "__main__":
    deploy()