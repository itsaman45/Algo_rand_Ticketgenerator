from pyteal import *

def ticketing_contract():
    """
    A simple Ticket Marketplace Smart Contract.
    
    Features:
    1. Initialize Event (Global State: Price, Supply, Sold)
    2. Buy Ticket (Payment + Local State Update)
    """

    # --- Global State Keys ---
    # Stores the creator/admin address
    admin_key = Bytes("admin") 
    # Stores ticket price in MicroAlgos
    ticket_price_key = Bytes("price")
    # Stores total tickets available
    total_supply_key = Bytes("total_supply")
    # Stores number of tickets sold
    tickets_sold_key = Bytes("sold")
    
    # --- Local State Keys (User Storage) ---
    # Stores how many tickets the user owns
    my_tickets_key = Bytes("my_tickets")

    # --- Subroutines ---

    @Subroutine(TealType.none)
    def check_is_admin():
        return Assert(Txn.sender() == App.globalGet(admin_key))

    # --- Application Logic ---

    # 1. Initialization (On Creation)
    handle_creation = Seq(
        App.globalPut(admin_key, Txn.sender()),
        App.globalPut(tickets_sold_key, Int(0)),
        # Default values (can be updated via setup call)
        App.globalPut(ticket_price_key, Int(1000000)), # 1 ALGO
        App.globalPut(total_supply_key, Int(100)),
        Approve()
    )

    # 2. Setup Event (Admin Only)
    # Args: [price, total_supply]
    setup_event = Seq(
        check_is_admin(),
        App.globalPut(ticket_price_key, Btoi(Txn.application_args[1])),
        App.globalPut(total_supply_key, Btoi(Txn.application_args[2])),
        Approve()
    )

    # 3. Buy Ticket
    # Group Txn 0: Payment from User to Admin
    # Group Txn 1: App Call (this contract)
    buy_ticket = Seq(
        # Check that the payment transaction is correct
        Assert(Gtxn[0].type_enum() == TxnType.Payment),
        Assert(Gtxn[0].receiver() == App.globalGet(admin_key)), 
        Assert(Gtxn[0].amount() == App.globalGet(ticket_price_key)),
        
        # Check supply
        Assert(App.globalGet(tickets_sold_key) < App.globalGet(total_supply_key)),

        # Update Global State (Increment Sold)
        App.globalPut(tickets_sold_key, App.globalGet(tickets_sold_key) + Int(1)),

        # Update Local State (Increment User's Ticket Count)
        App.localPut(Txn.sender(), my_tickets_key, App.localGet(Txn.sender(), my_tickets_key) + Int(1)),
        
        Approve()
    )

    # --- Router ---
    program = Cond(
        [Txn.application_id() == Int(0), handle_creation],
        [Txn.on_completion() == OnComplete.DeleteApplication, Return(Txn.sender() == App.globalGet(admin_key))],
        [Txn.on_completion() == OnComplete.UpdateApplication, Return(Txn.sender() == App.globalGet(admin_key))],
        [Txn.on_completion() == OnComplete.OptIn, Approve()], # Allow Opt-In
        [Txn.on_completion() == OnComplete.CloseOut, Approve()],
        [Txn.on_completion() == OnComplete.NoOp, Cond(
            [Txn.application_args[0] == Bytes("setup"), setup_event],
            [Txn.application_args[0] == Bytes("buy"), buy_ticket],
        )]
    )

    return program

if __name__ == "__main__":
    # Compile the program when run directly
    with open("approval.teal", "w") as f:
        compiled = compileTeal(ticketing_contract(), mode=Mode.Application, version=6)
        f.write(compiled)
    
    # Simple Clear State Program (Always Approve)
    with open("clear.teal", "w") as f:
        compiled = compileTeal(Approve(), mode=Mode.Application, version=6)
        f.write(compiled)

    print("PyTeal contracts compiled successfully to .teal files.")
