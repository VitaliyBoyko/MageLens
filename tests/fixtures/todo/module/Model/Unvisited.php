<?php
declare(strict_types=1);
namespace Vitalii\TodoList\Model;

// This file deliberately never loads: it must still appear as uncovered.
class Unvisited
{
    public function message(): string
    {
        return 'This path was not visited';
    }
}
