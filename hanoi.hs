data Peg = L | C | R 
    deriving(Bounded, Enum, Show)
hanoi :: Int -> Peg -> Peg -> Peg -> [(Peg, Peg)]
hanoi 0 _ _ _ = []
hanoi 1 a b c = [(a, c)]
hanoi n a b c = hanoi (n-1) a c b ++ [(a, c)] ++ hanoi (n-1) b a c