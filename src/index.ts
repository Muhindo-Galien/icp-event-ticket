import {
  $query,
  $update,
  Record,
  StableBTreeMap,
  Vec,
  match,
  Result,
  nat64,
  ic,
  Opt,
} from "azle";
import { v4 as uuidv4 } from "uuid";

type EventTicket = Record<{
  id: string;
  title: string;
  description: string;
  price: number;
  totalTicketSold: number;
  createdAt: nat64;
  updatedAt: Opt<nat64>;
}>;

type TicketSold = Record<{
  id: string;
  eventTicketId: string;
  username: string;
}>;

type EventTicketPayload = Record<{
  title: string;
  description: string;
  price: number;
}>;

const eventTicketStorage = new StableBTreeMap<string, EventTicket>(0, 44, 1024);

const ticketSoldStorage = new StableBTreeMap<string, TicketSold>(0, 44, 1024);

$query;
export function getAllEventTickets(): Result<Vec<EventTicket>, string> {
  return Result.Ok(eventTicketStorage.values());
}

$update;
export function createEventTicket(
  payload: EventTicketPayload
): Result<EventTicket, string> {
  const newTicket: EventTicket = {
    id: uuidv4(),
    createdAt: ic.time(),
    updatedAt: Opt.None,
    ...payload,
    totalTicketSold: 0,
  };
  eventTicketStorage.insert(newTicket.id, newTicket);
  return Result.Ok(newTicket);
}

$query;
export function getEventTicketById(id: string): Result<EventTicket, string> {
  return match(eventTicketStorage.get(id), {
    Some: (ticket) => Result.Ok<EventTicket, string>(ticket),
    None: () =>
      Result.Err<EventTicket, string>(`event ticket with id=${id} not found`),
  });
}

$update;
export function deleteEventTicket(id: string): Result<EventTicket, string> {
  return match(eventTicketStorage.remove(id), {
    Some: (ticket) => Result.Ok<EventTicket, string>(ticket),
    None: () =>
      Result.Err<EventTicket, string>(
        `couldn't delete ticket with id=${id}. Profile not found.`
      ),
  });
}

$query;
export function getTicketSoldById(id: string): Result<TicketSold, string> {
  return match(ticketSoldStorage.get(id), {
    Some: (ticket) => Result.Ok<TicketSold, string>(ticket),
    None: () =>
      Result.Err<TicketSold, string>(`ticket sold with id=${id} not found`),
  });
}

$update;
export function buyTicket(
  id: string,
  username: string
): Result<TicketSold, string> {
  const eventTicket = getEventTicketById(id);

  if (eventTicket.isErr()) {
    return Result.Err<EventTicket, string>(
      `Event ticket with id=${id} not found.`
    );
  }

  const ticket = eventTicket.unwrap();

  const newTicket = {
    id: uuidv4(),
    eventTicketId: ticket.id,
    username: username,
  };

  ticketSoldStorage.insert(newTicket.id, newTicket);

  const updateEventTicket = {
    ...ticket,
    totalTicketSold: ticket.totalTicketSold + 1,
    updatedAt: Opt.Some(ic.time()),
  };

  eventTicketStorage.insert(updateEventTicket.id, updateEventTicket);

  return Result.Ok<TicketSold, string>(newTicket);
}

$update;
export function resellTicket(
  id: string,
  username: string
): Result<TicketSold, string> {
  const ticket = getTicketSoldById(id);

  if (ticket.isErr()) {
    return Result.Err<EventTicket, string>(
      `ticket sold with id=${id} not found.`
    );
  }

  const newTicket = {
    ...ticket.unwrap(),
    username: username,
  };

  ticketSoldStorage.insert(newTicket.id, newTicket);

  return Result.Ok<TicketSold, string>(newTicket);
}

$query;
export function checkTicketAvailability(id: string): Result<boolean, string> {
  const eventTicket = getEventTicketById(id);
  
  if (eventTicket.isErr()) {
    return Result.Err<boolean, string>(
      `Event ticket with id=${id} not found.`
    );
  }
  
  const ticket = eventTicket.unwrap();
  const availableTickets = ticket.totalTicketSold < ticket.capacity;
  
  return Result.Ok<boolean, string>(availableTickets);
}

$update;
export function reserveTicket(id: string, username: string): Result<string, string> {
  const eventTicket = getEventTicketById(id);
  
  if (eventTicket.isErr()) {
    return Result.Err<string, string>(
      `Event ticket with id=${id} not found.`
    );
  }
  
  const ticket = eventTicket.unwrap();
  
  if (ticket.reservedBy && ticket.reservedBy !== username) {
    return Result.Err<string, string>(`Ticket is already reserved by another user.`);
  }
  
  const updatedTicket = {
    ...ticket,
    reservedBy: username,
  };
  
  eventTicketStorage.insert(updatedTicket.id, updatedTicket);
  
  return Result.Ok<string, string>(updatedTicket.id);
}

$update;
export function transferTicket(id: string, newOwner: string): Result<string, string> {
  const ticket = getTicketSoldById(id);
  
  if (ticket.isErr()) {
    return Result.Err<string, string>(
      `Ticket sold with id=${id} not found.`
    );
  }
  
  const updatedTicket = {
    ...ticket.unwrap(),
    username: newOwner,
  };
  
  ticketSoldStorage.insert(updatedTicket.id, updatedTicket);
  
  return Result.Ok<string, string>(updatedTicket.id);
}

$update;
export function requestTicketRefund(id: string): Result<string, string> {
  const ticket = getTicketSoldById(id);
  
  if (ticket.isErr()) {
    return Result.Err<string, string>(
      `Ticket sold with id=${id} not found.`
    );
  }
  
  ticketSoldStorage.remove(id);
  
  return Result.Ok<string, string>(id);
}

// a workaround to make uuid package work with Azle
globalThis.crypto = {
  getRandomValues: () => {
    let array = new Uint8Array(32);

    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }

    return array;
  },
};
