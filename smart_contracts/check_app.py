from algosdk.v2client import algod

client = algod.AlgodClient("", "https://testnet-api.algonode.cloud")

app_id = 755804005

info = client.application_info(app_id)
print(info)